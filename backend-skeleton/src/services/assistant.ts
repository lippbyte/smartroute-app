// Task Backend-06 (Bagian A): orchestrates one question -> one answer.
// Perluasan (diminta user langsung, 2026-09-23): asisten kini tahu posisi GPS
// user (halte terdekat + rute jalan kaki ke sana) dan menerima beberapa
// giliran percakapan terakhir dari app supaya pertanyaan lanjutan nyambung.
// Backend tetap tidak menyimpan riwayat apa pun — app yang mengirimnya.
import type { RouteCandidate } from "../types/schema";
import { computeRouteRecommendation } from "./routing";
import { getGtfsContextText } from "./gtfsContext";
import { findNearbyStops, type NearbyStop, type TransitMode } from "./nearbyStops";
import { JAKLINGKO_CATEGORY } from "./tjRouteCategory";
import { askOpenRouter, type ChatMessage } from "../lib/openRouterClient";
import { recordOpenRouterCall } from "../lib/openRouterRateLimit";

type LatLng = { lat: number; lng: number };

export interface AssistantAskContext {
  origin?: LatLng;
  destination?: LatLng;
  user_location?: LatLng;
}

export interface AssistantHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAnswer {
  answer: string;
  // Diisi hanya kalau pertanyaannya soal halte di sekitar user — app
  // menampilkannya sebagai tombol aksi (rute jalan ke sana / berangkat dari
  // sana) di bawah jawaban.
  nearby_stops: NearbyStop[];
}

// Strict grounding instruction — the task brief's central requirement for
// this endpoint: answer only from the supplied data, never fabricate.
const SYSTEM_PROMPT_HEADER =
  "Anda adalah TOTO (Transit Optimization Travel Orchestration), asisten " +
  "wayfinding transportasi umum Jakarta (TransJakarta, JakLingko, MRT, LRT, " +
  "KRL) di dalam aplikasi SmartRoute. Sebut diri Anda TOTO bila memperkenalkan " +
  "diri; gaya bicara ramah dan santai. Jawab HANYA " +
  "berdasarkan data yang diberikan di bawah ini — JANGAN mengarang nama rute, " +
  "halte, jarak, tarif, jadwal, atau fakta apa pun yang tidak tercantum. Kalau " +
  "informasi yang dibutuhkan tidak ada di data, katakan dengan jujur bahwa Anda " +
  "tidak punya data itu. Jawab singkat, jelas, dan dalam Bahasa Indonesia " +
  "(kecuali pengguna jelas bertanya dalam bahasa lain).\n\n" +
  "Kalau pengguna bertanya halte/stasiun terdekat, sebutkan yang paling dekat " +
  "beserta jaraknya dari daftar HALTE TERDEKAT. Kalau ada data RUTE JALAN KAKI, " +
  "jelaskan langkahnya secara ringkas (arah & nama jalan). Di bawah jawaban " +
  "Anda, aplikasi menampilkan kartu halte dengan dua tombol: \"Jalan ke sini\" " +
  "(navigasi jalan kaki dari posisi pengguna) dan \"Berangkat dari sini\" " +
  "(menjadikan halte itu titik berangkat pencarian rute). Sebut tombol dengan " +
  "nama persis itu kalau menyarankannya. Pencarian rute paling lengkap kalau " +
  "titik berangkatnya tepat di halte/stasiun.";

const MODE_NAME: Record<TransitMode, string> = {
  transjakarta: "Halte TransJakarta",
  jaklingko: "Titik JakLingko (Mikrotrans)",
  mrt: "Stasiun MRT",
  lrt: "Stasiun LRT",
};

// "halte terdekat", "dekat sini", "gimana jalan ke sana", dst. — pertanyaan
// yang butuh tombol aksi halte di app dan rute jalan kaki ke halte terdekat.
const NEARBY_INTENT =
  /terdekat|paling dekat|dekat (sini|saya|aku|lokasi)|di ?sekitar|sekitar (sini|saya|aku)|lokasi (saya|aku|ku)|posisi (saya|aku|ku)|jalan kaki|ke ?sana|halte mana|stasiun mana/i;

// Moda yang disebut di pertanyaan ("MRT terdekat") — kartu aksi & rute jalan
// kaki diarahkan ke moda itu, bukan ke titik JakLingko yang kebetulan paling
// dekat.
const MODE_KEYWORDS: Array<[TransitMode, RegExp]> = [
  ["mrt", /\bmrt\b/i],
  ["lrt", /\blrt\b/i],
  ["transjakarta", /transjakarta|busway|\btj\b|\bbrt\b/i],
  ["jaklingko", /jaklingko|mikrotrans|angkot/i],
];

const ALL_MODES: TransitMode[] = ["transjakarta", "mrt", "lrt", "jaklingko"];
const SEARCH_RADIUS_M = 5000;
const MAX_PROMPT_STOPS = 5;
const MAX_ACTION_STOPS = 3;
// Kalau OTP2 masih "dingin", satu pencarian bisa belasan detik (lihat catatan
// latensi di README) — jangan sampai rute jalan kaki membuat seluruh jawaban
// melewati batas waktu app. Lewat dari ini, asisten tetap menjawab dari
// daftar halte saja.
const WALK_ROUTE_TIMEOUT_MS = 7_000;

function describeLeg(leg: RouteCandidate["legs"][number]): string {
  const trip = `${leg.from} -> ${leg.to}`;
  if (leg.mode === "BUS") {
    // Kategori resmi dari GTFS; JakLingko (Mikrotrans) gratis, jadi kalau
    // disebut "TransJakarta" LLM bisa mengarang tarif Rp3.500 untuknya.
    const operator =
      leg.route_category === JAKLINGKO_CATEGORY ? "JakLingko" : "TransJakarta";
    const category =
      leg.route_category && leg.route_category !== JAKLINGKO_CATEGORY
        ? ` [${leg.route_category}]`
        : "";
    return `naik ${operator} ${leg.route_name ?? "?"}${category} (${trip})`;
  }
  if (leg.mode === "RAIL") return `naik KRL ${leg.route_name ?? "?"} (${trip})`;
  // Tanpa baris ini leg MRT jatuh ke "jalan kaki" di bawah — LLM akan
  // disuguhi fakta bahwa pengguna berjalan kaki Lebak Bulus -> Bundaran HI.
  if (leg.mode === "SUBWAY") return `naik MRT (${trip})`;
  if (leg.mode === "TRAM") return `naik LRT Jabodebek ${leg.route_name ?? "?"} (${trip})`;
  if (leg.mode === "WALK") return `jalan kaki (${trip})`;
  // Moda yang belum dikenal lebih baik disebut apa adanya daripada dikira
  // jalan kaki — salah itu yang barusan hampir terjadi pada MRT.
  return `naik ${leg.mode} (${trip})`;
}

function describeCandidate(route: RouteCandidate): string {
  const legs = route.legs.map(describeLeg).join(", lalu ");
  const parts = [
    `Rute "${route.route_id}": ${legs}`,
    `estimasi ${route.travel_time_minutes.min}-${route.travel_time_minutes.max} menit`,
    `${route.transfer_count} kali transit`,
    `tarif Rp${route.cost_idr.toLocaleString("id-ID")}`,
  ];
  if (route.crowd_level) parts.push(`kepadatan: ${route.crowd_level}`);
  if (route.reliability) parts.push(`keandalan sambungan: ${route.reliability.risk}`);
  return `- ${parts.join(", ")}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

// If the caller already knows a specific origin/destination (per the task
// brief: "context opsional, kalau user sedang mencari rute spesifik"), ask
// our own routing engine for the real candidates and hand those to the LLM
// as concrete grounding. If the routing engine itself fails for any reason,
// degrade to answering from the general context alone rather than failing
// the whole request — a route-planning hiccup shouldn't take down basic Q&A.
async function buildGroundedRouteText(context: AssistantAskContext | undefined): Promise<string> {
  if (!context?.origin || !context?.destination) return "";

  try {
    const recommendation = await computeRouteRecommendation(context.origin, context.destination);
    if (recommendation.routes.length === 0) {
      return (
        "\n\nHasil pencarian rute konkret untuk asal-tujuan yang dimaksud pengguna: " +
        "mesin routing tidak menemukan rute transit saat ini."
      );
    }
    return (
      "\n\nHasil pencarian rute konkret untuk asal-tujuan yang dimaksud pengguna " +
      "(dari mesin routing kami, sudah diurutkan dari yang paling direkomendasikan):\n" +
      recommendation.routes.map(describeCandidate).join("\n")
    );
  } catch {
    return "";
  }
}

// Satu halte fisik bisa muncul berkali-kali (tiap peron punya stop_id
// sendiri — mis. 6 peron Monas); untuk dibacakan ke user cukup sekali.
function dedupeStops(stops: NearbyStop[]): NearbyStop[] {
  const seen = new Set<string>();
  return stops.filter((s) => {
    const key = `${s.mode}|${s.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Semua halte dalam 5 km tanpa batas jumlah — di area padat, 30 teratas bisa
// seluruhnya titik JakLingko dan stasiun MRT/LRT terdekat tidak pernah
// terlihat oleh asisten.
async function findStopsAround(location: LatLng): Promise<NearbyStop[]> {
  try {
    return dedupeStops(
      await findNearbyStops(location.lat, location.lng, SEARCH_RADIUS_M, Infinity)
    );
  } catch {
    return [];
  }
}

function formatStop(s: NearbyStop): string {
  return `${s.name} (${MODE_NAME[s.mode]}) — ${s.distance_m} m garis lurus`;
}

function describeStops(stops: NearbyStop[]): string {
  if (stops.length === 0) {
    return (
      "\n\nHALTE TERDEKAT dari posisi GPS pengguna: tidak ada halte/stasiun dalam " +
      "radius 5 km."
    );
  }
  const overall = stops.slice(0, MAX_PROMPT_STOPS);
  const perMode = ALL_MODES.map((mode) => {
    const nearest = stops.find((s) => s.mode === mode);
    return `- ${MODE_NAME[mode]}: ${nearest ? formatStop(nearest) : "tidak ada dalam 5 km"}`;
  });
  return (
    "\n\nHALTE TERDEKAT dari posisi GPS pengguna saat ini (jarak garis lurus; " +
    "jarak jalan kaki biasanya sedikit lebih jauh).\nUrut dari yang terdekat:\n" +
    overall.map((s, i) => `${i + 1}. ${formatStop(s)}`).join("\n") +
    "\nTerdekat per moda:\n" +
    perMode.join("\n")
  );
}

async function buildWalkRouteText(from: LatLng, stop: NearbyStop): Promise<string> {
  const recommendation = await withTimeout(
    computeRouteRecommendation(from, { lat: stop.lat, lng: stop.lng }),
    WALK_ROUTE_TIMEOUT_MS
  );
  const walk = recommendation?.routes.find((r) => r.legs.every((l) => l.mode === "WALK"));
  if (!walk) return "";

  const steps = walk.legs
    .flatMap((l) => l.walk_steps ?? [])
    .map((s) => `${s.direction} ${s.street} (${Math.round(s.distance_m)} m)`);
  return (
    `\n\nRUTE JALAN KAKI dari posisi pengguna ke ${stop.name}: ` +
    `${walk.walking_distance_m} m, sekitar ${walk.travel_time_minutes.min} menit.` +
    (steps.length > 0
      ? ` Langkah (arah dalam istilah OTP: DEPART=mulai, LEFT=belok kiri, ` +
        `RIGHT=belok kanan, SLIGHTLY_*=agak, CONTINUE=lurus): ${steps.join("; ")}.`
      : "")
  );
}

export async function askAssistant(
  question: string,
  context?: AssistantAskContext,
  history: AssistantHistoryTurn[] = []
): Promise<AssistantAnswer> {
  const userLocation = context?.user_location;
  const wantsNearby = userLocation != null && NEARBY_INTENT.test(question);

  const [groundedRouteText, stops] = await Promise.all([
    buildGroundedRouteText(context),
    userLocation ? findStopsAround(userLocation) : Promise.resolve([]),
  ]);

  const requestedModes = MODE_KEYWORDS.filter(([, re]) => re.test(question)).map(([m]) => m);
  const targetStops =
    requestedModes.length > 0 ? stops.filter((s) => requestedModes.includes(s.mode)) : stops;

  const walkRouteText =
    wantsNearby && userLocation && targetStops.length > 0
      ? await buildWalkRouteText(userLocation, targetStops[0])
      : "";

  const locationText = userLocation
    ? describeStops(stops) + walkRouteText
    : "\n\nPosisi GPS pengguna tidak tersedia (izin lokasi belum diberikan) — kalau " +
      "ditanya halte terdekat, minta pengguna mengaktifkan izin lokasi.";

  const systemPrompt =
    `${SYSTEM_PROMPT_HEADER}\n\n${getGtfsContextText()}${locationText}${groundedRouteText}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: question },
  ];

  recordOpenRouterCall();
  const answer = await askOpenRouter(messages);
  return {
    answer,
    nearby_stops: wantsNearby ? targetStops.slice(0, MAX_ACTION_STOPS) : [],
  };
}
