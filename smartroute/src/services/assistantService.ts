// src/services/assistantService.ts
//
// Task App-22: data layer untuk UI Asisten AI — memanggil POST
// /assistant/ask. Pola fetch-wrapper sama persis dengan crowdService.ts/
// nearbyStopsService.ts (custom Error subclass, cek network-error vs status
// non-ok) supaya konsisten satu gaya di seluruh services/.
//
// Perluasan (diminta user langsung, 2026-09-23): ikut mengirim posisi GPS
// user, asal/tujuan yang sudah di-geocode, dan beberapa giliran percakapan
// terakhir; backend membalas jawaban + halte terdekat untuk tombol aksi.
import { Coordinate } from "@/utils/geocode";
import { fetchWithTimeout, RequestTimeoutError } from "@/utils/withTimeout";
import { API_BASE_URL } from "./apiConfig";
import { NearbyStop } from "./nearbyStopsService";

// Backend memotong OpenRouter di 15 detik; sebelum itu ia bisa memanggil
// mesin rute dulu (rute asal-tujuan, atau rute jalan kaki ke halte terdekat
// yang dibatasi 7 detik). 25 detik memberi ruang di atas itu tanpa membiarkan
// layar menggantung tanpa batas.
const ASSISTANT_TIMEOUT_MS = 25_000;

export class AssistantAskError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AssistantAskError";
  }
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAskOptions {
  userLocation?: Coordinate | null;
  origin?: Coordinate | null;
  destination?: Coordinate | null;
  history?: AssistantTurn[];
}

export interface AssistantReply {
  answer: string;
  nearbyStops: NearbyStop[];
}

const toLatLng = (c: Coordinate) => ({ lat: c.latitude, lng: c.longitude });

export async function askAssistant(
  question: string,
  options: AssistantAskOptions = {},
): Promise<AssistantReply> {
  const { userLocation, origin, destination, history } = options;
  const context = {
    ...(userLocation ? { user_location: toLatLng(userLocation) } : {}),
    ...(origin && destination
      ? { origin: toLatLng(origin), destination: toLatLng(destination) }
      : {}),
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/assistant/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        ...(Object.keys(context).length > 0 ? { context } : {}),
        ...(history && history.length > 0 ? { history } : {}),
      }),
      timeoutMs: ASSISTANT_TIMEOUT_MS,
      timeoutMessage:
        "TOTO tidak menjawab dalam 25 detik. Coba tanya lagi dengan kalimat yang lebih singkat.",
    });
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new AssistantAskError(err.message, err);
    throw new AssistantAskError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}. Pastikan server backend jalan.`,
      err,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new AssistantAskError("Response backend bukan JSON yang valid.", err);
  }

  if (!res.ok) {
    // Backend selalu mengisi `message` yang jelas untuk tiap status error
    // (400 invalid_request, 502 assistant_unavailable, 500 internal_error)
    // — diteruskan apa adanya, bukan pesan generik.
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Backend mengembalikan status ${res.status}.`;
    throw new AssistantAskError(message);
  }

  const { answer, nearby_stops } = (body ?? {}) as {
    answer?: unknown;
    nearby_stops?: unknown;
  };
  if (typeof answer !== "string") {
    throw new AssistantAskError("Response backend tidak berisi jawaban yang valid.");
  }
  return {
    answer,
    nearbyStops: Array.isArray(nearby_stops) ? (nearby_stops as NearbyStop[]) : [],
  };
}
