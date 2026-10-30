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
//
// Hari 1 Task 4: TOTO wajib masuk — token dikirim lewat apiClient, yang juga
// menangani 401 session_expired (AuthContext mengarahkan ke layar Masuk),
// 429 (pesan batas dari backend diteruskan apa adanya), timeout, dan
// jaringan putus dengan pesan yang jelas.
import { Coordinate } from "@/utils/geocode";
import { apiRequest } from "./apiClient";
import { NearbyStop } from "./nearbyStopsService";

// Backend memotong OpenRouter di 15 detik; sebelum itu ia bisa memanggil
// mesin rute dulu (rute asal-tujuan, atau rute jalan kaki ke halte terdekat
// yang dibatasi 7 detik). 25 detik memberi ruang di atas itu tanpa membiarkan
// layar menggantung tanpa batas.
const ASSISTANT_TIMEOUT_MS = 25_000;

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

/** Melempar ApiError dengan pesan siap tampil. Backend selalu mengisi
 *  `message` yang jelas (401, 429 batas per jam/harian, 502 asisten tidak
 *  tersedia) — diteruskan apa adanya, bukan pesan generik. */
export async function askAssistant(
  token: string,
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

  const { answer, nearby_stops } = await apiRequest<{ answer?: unknown; nearby_stops?: unknown }>(
    "POST",
    "/assistant/ask",
    {
      token,
      body: {
        question,
        ...(Object.keys(context).length > 0 ? { context } : {}),
        ...(history && history.length > 0 ? { history } : {}),
      },
      timeoutMs: ASSISTANT_TIMEOUT_MS,
      timeoutMessage: "TOTO tidak menjawab dalam 25 detik. Coba tanya lagi dengan kalimat yang lebih singkat.",
    },
  );
  if (typeof answer !== "string") {
    throw new Error("Jawaban dari server tidak valid. Coba lagi.");
  }
  return {
    answer,
    nearbyStops: Array.isArray(nearby_stops) ? (nearby_stops as NearbyStop[]) : [],
  };
}
