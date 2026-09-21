// Task Backend-06 (Bagian A): orchestrates one question -> one answer.
// Deliberately stateless (per the task's explicit "jangan buat sistem
// memory/history" constraint) — no conversation state kept between calls.
import type { RouteCandidate } from "../types/schema";
import { computeRouteRecommendation } from "./routing";
import { getGtfsContextText } from "./gtfsContext";
import { JAKLINGKO_CATEGORY } from "./tjRouteCategory";
import { askOpenRouter } from "../lib/openRouterClient";
import { recordOpenRouterCall } from "../lib/openRouterRateLimit";

export interface AssistantAskContext {
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
}

// Strict grounding instruction — the task brief's central requirement for
// this endpoint: answer only from the supplied GTFS data, never fabricate.
const SYSTEM_PROMPT_HEADER =
  "Anda adalah asisten wayfinding untuk sistem transit TransJakarta. Jawab HANYA " +
  "berdasarkan data GTFS yang diberikan di bawah ini — JANGAN mengarang nama rute, " +
  "tarif, jadwal, atau fakta apa pun yang tidak tercantum di data tersebut. Kalau " +
  "informasi yang dibutuhkan untuk menjawab tidak ada di data yang diberikan, " +
  "katakan dengan jujur bahwa Anda tidak punya data itu — jangan menebak atau " +
  "mengarang jawaban yang terdengar masuk akal. Jawab singkat, jelas, dan dalam " +
  "Bahasa Indonesia (kecuali pengguna jelas bertanya dalam bahasa lain).";

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

// If the caller already knows a specific origin/destination (per the task
// brief: "context opsional, kalau user sedang mencari rute spesifik"), ask
// our own routing engine for the real candidates and hand those to the LLM
// as concrete grounding — so a question like "naik apa dari sini ke sana"
// gets phrased around actual computed routes, not just the general route
// list. If the routing engine itself fails for any reason, degrade to
// answering from the general GTFS context alone rather than failing the
// whole request — a route-planning hiccup shouldn't take down basic Q&A.
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

export async function askAssistant(question: string, context?: AssistantAskContext): Promise<string> {
  const groundedRouteText = await buildGroundedRouteText(context);
  const systemPrompt = `${SYSTEM_PROMPT_HEADER}\n\n${getGtfsContextText()}${groundedRouteText}`;

  recordOpenRouterCall();
  return askOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ]);
}
