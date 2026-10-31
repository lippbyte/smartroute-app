// src/services/crowdService.ts
//
// Data layer for Task App-01 (crowd-density overview map): calls the real
// GET /crowd-reports list endpoint from Task Backend-07 — no synthetic data,
// per that task's explicit constraint ("Jangan integrasikan data sintetis
// apa pun — hanya data asli dari endpoint Backend-07").
// See backend/Task_App_01_Crowd_Overview_Map.md for the task this implements.

import { apiRequest, UNAVAILABLE_MESSAGE } from "./apiClient";

const CROWD_TIMEOUT_MS = 10_000;
// Dipanggil dari input yang diketik user — batas lebih pendek supaya saran
// yang tak kunjung datang cepat menyerah, bukan menahan dropdown.
const STOP_SEARCH_TIMEOUT_MS = 8_000;

export type CrowdLevel = "low" | "moderate" | "high";

// Mirrors the response shape from backend/backend-skeleton/src/routes/crowdReports.ts
// (GET /crowd-reports) by hand — same reasoning as routeService.ts's backend
// contract mirror: the two projects aren't wired into one workspace.
export interface CrowdOverviewStop {
  stop_id: string;
  name: string;
  lat: number;
  lng: number;
  level: CrowdLevel;
  reported_at: string; // ISO 8601
}

export class CrowdOverviewFetchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CrowdOverviewFetchError";
  }
}

/**
 * Ambil daftar halte yang punya laporan kepadatan aktif. Halte tanpa
 * laporan TIDAK ada di response — itu desain endpoint-nya (lihat Task
 * Backend-07), bukan data yang hilang/bug.
 */
export async function fetchCrowdOverview(): Promise<CrowdOverviewStop[]> {
  // Hari 4 Task 1: pemetaan galat terpusat (apiClient).
  try {
    return await apiRequest<CrowdOverviewStop[]>("GET", "/crowd-reports", {
      timeoutMs: CROWD_TIMEOUT_MS,
      timeoutMessage: "Memuat peta kepadatan terlalu lama. Coba lagi.",
    });
  } catch (err) {
    throw new CrowdOverviewFetchError(err instanceof Error ? err.message : UNAVAILABLE_MESSAGE, err);
  }
}

// Mirrors backend/backend-skeleton/src/lib/otpClient.ts's OtpStop, returned
// by GET /stops/search.
export interface StopSearchResult {
  gtfsId: string;
  name: string;
  lat: number;
  lng: number;
}

export class StopSearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StopSearchError";
  }
}

/**
 * Task App-07: cari halte OTP2 by nama untuk alur "pilih halte lalu lapor
 * kepadatan" — SENGAJA bukan reuse geocode.ts/Nominatim dari App-06.
 * Nominatim tidak tahu apa-apa soal identitas GTFS (tidak ada gtfsId di
 * hasilnya), padahal submit laporan wajib pakai gtfsId asli OTP2 (Task
 * Backend-08) — dua sumber data berbeda untuk kebutuhan yang berbeda.
 *
 * @param signal - untuk membatalkan request lama kalau user lanjut
 *   mengetik, pola sama seperti useLocationSuggestions (App-06).
 */
export async function searchStops(
  query: string,
  signal?: AbortSignal,
): Promise<StopSearchResult[]> {
  // Hari 4 Task 1: pemetaan galat terpusat (apiClient). Pembatalan oleh
  // signal diteruskan apa adanya — apiClient mengecek signal.aborted
  // langsung, bukan bentuk galat (di Hermes, fetch yang di-abort tidak
  // selalu melempar "AbortError"; temuan uji device fisik Task App-12).
  try {
    return await apiRequest<StopSearchResult[]>("GET", `/stops/search?q=${encodeURIComponent(query)}`, {
      signal,
      timeoutMs: STOP_SEARCH_TIMEOUT_MS,
      timeoutMessage: "Pencarian halte terlalu lama. Coba ketik lagi.",
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new StopSearchError(err instanceof Error ? err.message : UNAVAILABLE_MESSAGE, err);
  }
}

export class CrowdReportSubmitError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CrowdReportSubmitError";
  }
}

/**
 * Submit satu laporan kepadatan (Task App-07). `stopId` harus gtfsId OTP2
 * (dari searchStops di atas, atau dari stop_id yang sudah tampil di
 * fetchCrowdOverview) — bukan format halte manapun yang lain, sesuai
 * skema tunggal yang disatukan Task Backend-08.
 */
export async function submitCrowdReport(
  stopId: string,
  level: CrowdLevel,
): Promise<void> {
  // Hari 4 Task 1: pemetaan galat terpusat (apiClient).
  try {
    await apiRequest("POST", "/crowd-reports", {
      body: { stop_id: stopId, level },
      timeoutMs: CROWD_TIMEOUT_MS,
      timeoutMessage: "Mengirim laporan kepadatan terlalu lama. Coba lagi.",
    });
  } catch (err) {
    throw new CrowdReportSubmitError(err instanceof Error ? err.message : UNAVAILABLE_MESSAGE, err);
  }
}
