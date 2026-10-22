// src/services/routeService.ts
//
// Integration layer for Task Integration-01: connects the route-search
// screen to the real backend (`POST /routes`) instead of `mockApiResponse`.
// See backend/Task_Integration_01_Frontend_Backend.md for the task this
// implements.

import { ApiResponse, CrowdInfo, Leg, RouteItem } from "@/type";
import { fetchWithTimeout, RequestTimeoutError } from "@/utils/withTimeout";
import { API_BASE_URL } from "./apiConfig";
import { LEG_MODES, legModeFromBackend } from "@/components/transit/legModes";

// Latensi POST /routes terukur 2–19 detik (OTP2 menghitung beberapa kandidat
// sekaligus). 30 detik dipilih di ATAS maksimum terukur itu: tujuannya
// memutus request yang benar-benar menggantung, bukan memotong pencarian
// yang sebenarnya masih berjalan normal.
const ROUTES_TIMEOUT_MS = 30_000;

// ---- Backend contract -----------------------------------------------------
// Mirrors backend/backend-skeleton/src/types/schema.ts by hand — the two
// projects (backend/smartroute) aren't wired into one workspace/package, so
// this can't be imported directly. If the backend schema changes, this must
// be updated to match.

export interface BackendRouteLeg {
  mode: "WALK" | "BUS" | "RAIL" | "SUBWAY" | "TRAM";
  route_name?: string;
  // Leg BUS saja: kategori resmi route_desc TransJakarta ("BRT",
  // "Mikrotrans", ...) — pembeda BRT/feeder/JakLingko.
  route_category?: string;
  from: string;
  to: string;
  // Data navigasi (lihat RouteLeg di skema backend).
  from_coord?: { lat: number; lng: number };
  to_coord?: { lat: number; lng: number };
  headsign?: string;
  path?: Array<[number, number]>;
  stops_passed?: Array<{ name: string; lat: number; lng: number }>;
  walk_steps?: Array<{
    distance_m: number;
    direction: string;
    street: string;
    lat?: number;
    lng?: number;
  }>;
  depart_at?: string;
  arrive_at?: string;
  distance_m?: number;
}

export interface BackendRouteCandidate {
  route_id: string;
  legs: BackendRouteLeg[];
  travel_time_minutes: { min: number; max: number };
  transfer_count: number;
  walking_distance_m: number;
  cost_idr: number;
  // Task Backend-04 — diisi backend kalau ada laporan kepadatan aktif untuk
  // halte yang dilewati rute (15 menit terakhir), undefined kalau belum ada.
  crowd_level?: "low" | "moderate" | "high";
  // Task Backend-05 — sudah diisi backend saat ini.
  reliability?: { score: number; risk: "low" | "medium" | "high" };
  // Task Backend-06 — skor gabungan ranking, selalu diisi backend (beda
  // dari crowd_level/reliability di atas yang masih/pernah optional).
  recommendation_score: number;
}

export interface RouteRecommendation {
  request_id: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  routes: BackendRouteCandidate[];
  departure_time: string;
  generated_at: string;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export class RouteFetchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RouteFetchError";
  }
}

/**
 * Panggil backend asli POST /routes. Menggantikan mockApiResponse untuk
 * alur pencarian rute (Task Integration-01).
 */
export async function fetchRealRoutes(
  origin: Coordinate,
  destination: Coordinate,
  departureTime?: string,
  // Filter moda transit (lihat MODE_FILTERS di legModes.ts); undefined = semua.
  modes?: string[],
): Promise<RouteRecommendation> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        ...(departureTime ? { departure_time: departureTime } : {}),
        ...(modes?.length ? { modes } : {}),
      }),
      timeoutMs: ROUTES_TIMEOUT_MS,
      timeoutMessage:
        "Pencarian rute lebih dari 30 detik dan dihentikan. Coba lagi, atau periksa koneksi ke backend.",
    });
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new RouteFetchError(err.message, err);
    throw new RouteFetchError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}. Pastikan server backend jalan dan base URL sudah benar (device fisik butuh IP LAN, bukan localhost).`,
      err,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new RouteFetchError("Response backend bukan JSON yang valid.", err);
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Backend mengembalikan status ${res.status}.`;
    throw new RouteFetchError(message);
  }

  return body as RouteRecommendation;
}

// ---- TEMPORARY SHIM — hapus begitu tim frontend update type.ts langsung ke
// skema backend --------------------------------------------------------
//
// adaptToLegacyShape() ada supaya komponen UI yang sudah dipakai sekarang
// (RouteScreen, RouteDetailScreen, dll — dibangun di atas
// ApiResponse/RouteItem di src/type.ts) tidak perlu ditulis ulang di task
// integrasi ini. Rekonsiliasi skema permanen adalah keputusan terpisah yang
// perlu dibahas bersama pemilik frontend, di luar scope task ini.
//
// Ketidakcocokan skema yang ditemukan selama task ini (catatan untuk
// pemilik frontend, bukan diputuskan sepihak di sini):
// - `travel_time_minutes` backend adalah rentang {min,max}; field frontend
//   cuma angka tunggal. Shim ini memakai `min` apa adanya (bukan
//   rata-rata) supaya tidak menampilkan angka yang backend sendiri tidak
//   pernah kembalikan. Menampilkan rentang aslinya butuh perubahan
//   komponen (RouteOptionCard/RouteDetailCard) — di luar scope task ini,
//   lihat batasan eksplisit di Task_Integration_01_Frontend_Backend.md.
// - `comfort_score` sama sekali tidak ada di skema backend (tidak
//   direncanakan ada) — diisi undefined, komponen yang memakainya sudah
//   dibuat toleran.
// - `crowd_level` (Task Backend-04), `reliability` (Task Backend-05), dan
//   `recommendation_score` (Task Backend-06) SUDAH diisi backend secara
//   real (diverifikasi Task Integration-02) — shim ini meneruskannya, bukan
//   lagi selalu undefined seperti versi awal Task Integration-01:
//   - `crowd_level` backend adalah SATU level kualitatif
//     ("low"/"moderate"/"high", worst-case antar halte yang dilewati rute),
//     sedangkan `CrowdInfo` frontend punya current_level+predicted_level
//     terpisah plus predicted_occupancy numerik. Backend tidak membedakan
//     "sekarang" vs "prediksi" dan tidak punya angka okupansi, jadi
//     current_level & predicted_level diisi dari nilai real yang sama itu,
//     predicted_occupancy dibiarkan undefined (lihat CrowdInfo di
//     src/type.ts) — bukan angka tebakan.
//   - `reliability.score` diteruskan langsung; `risk` (kualitatif) tidak
//     dikonversi ke `delay_risk` (numerik) karena tidak ada UI yang
//     membacanya dan mengonversi enum ke angka sama saja menebak.
//   `crowd_level` masih genuinely undefined untuk rute yang halte-haltenya
//   belum pernah dapat laporan kepadatan (lihat crowdDensity.ts di backend)
//   — itu tetap ditampilkan graceful, bukan bug.

// Label tampilan diputuskan di legModes.ts, bukan di sini. Dulu fungsi ini
// punya switch sendiri yang menjatuhkan semua mode tak dikenal ke
// "TransJakarta" — begitulah leg MRT (SUBWAY) tampil sebagai bus.
function mapLegMode(leg: BackendRouteLeg): Leg["mode"] {
  return LEG_MODES[legModeFromBackend(leg.mode, leg.route_category)].label;
}

function mapCrowdLevel(
  level: BackendRouteCandidate["crowd_level"],
): CrowdInfo | undefined {
  if (!level) return undefined;
  const mapped = level === "moderate" ? "MEDIUM" : level.toUpperCase();
  const typed = mapped as CrowdInfo["current_level"];
  // Backend cuma punya satu level real-time-ish, bukan current vs predicted
  // terpisah — lihat catatan shim di atas.
  return { current_level: typed, predicted_level: typed };
}

/**
 * @param labels - nama asal/tujuan yang dipilih user. Backend hanya tahu
 *   koordinat, jadi ujung pertama & terakhir perjalanan (serta
 *   origin/destination.name) dari backend berupa string koordinat mentah —
 *   diganti dengan nama ini supaya layar hasil, detail, dan navigasi
 *   menampilkan nama tempat yang dipilih.
 */
export function adaptToLegacyShape(
  rec: RouteRecommendation,
  labels?: { origin?: string; destination?: string },
): ApiResponse {
  const routes: RouteItem[] = rec.routes.map((candidate, index) => ({
    route_id: candidate.route_id,
    rank: index + 1, // backend sudah mengurutkan dari yang paling relevan
    legs: candidate.legs.map<Leg>((leg, legIndex, legs) => ({
      mode: mapLegMode(leg),
      service: leg.route_name,
      from: legIndex === 0 && labels?.origin ? labels.origin : leg.from,
      to:
        legIndex === legs.length - 1 && labels?.destination
          ? labels.destination
          : leg.to,
      from_coord: leg.from_coord,
      to_coord: leg.to_coord,
      headsign: leg.headsign,
      path: leg.path,
      stops_passed: leg.stops_passed,
      walk_steps: leg.walk_steps,
      depart_at: leg.depart_at,
      arrive_at: leg.arrive_at,
      distance_m: leg.distance_m,
    })),
    travel_time_minutes: candidate.travel_time_minutes.min,
    cost_idr: candidate.cost_idr,
    transfers: candidate.transfer_count,
    walking_distance_m: candidate.walking_distance_m,
    // comfort_score: sengaja undefined, bukan angka tebakan — lihat catatan
    // shim di atas.
    comfort_score: undefined,
    // crowd: data real dari backend kalau ada laporan aktif untuk halte
    // yang dilewati; undefined kalau memang belum ada laporan.
    crowd: mapCrowdLevel(candidate.crowd_level),
    // reliability & recommendation_score: data real dari backend, diteruskan
    // apa adanya (lihat catatan shim soal `risk`/`delay_risk` di atas).
    reliability: candidate.reliability
      ? { score: candidate.reliability.score }
      : undefined,
    recommendation_score: candidate.recommendation_score,
    // Task App-20: sama untuk semua kandidat dalam satu pencarian (bukan
    // per-rute) — di-denormalize ke tiap RouteItem di sini supaya tetap
    // ikut terbawa saat satu item di-JSON.stringify ke layar
    // detail/navigasi (lihat catatan di type.ts).
    departure_time: rec.departure_time,
  }));

  return {
    request_id: rec.request_id,
    timestamp: rec.generated_at,
    origin: { ...rec.origin, name: labels?.origin ?? rec.origin.name },
    destination: {
      ...rec.destination,
      name: labels?.destination ?? rec.destination.name,
    },
    routes,
    departure_time: rec.departure_time,
    // Backend tidak mengirim objek `recommendation` terpisah — kandidat
    // pertama di `routes` sudah yang paling relevan (lihat `rank` di atas).
    recommendation: undefined,
  };
}
