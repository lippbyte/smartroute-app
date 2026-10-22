// src/services/crowdService.ts
//
// Data layer for Task App-01 (crowd-density overview map): calls the real
// GET /crowd-reports list endpoint from Task Backend-07 — no synthetic data,
// per that task's explicit constraint ("Jangan integrasikan data sintetis
// apa pun — hanya data asli dari endpoint Backend-07").
// See backend/Task_App_01_Crowd_Overview_Map.md for the task this implements.

import { fetchWithTimeout, RequestTimeoutError } from "@/utils/withTimeout";
import { API_BASE_URL } from "./apiConfig";

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
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/crowd-reports`, {
      timeoutMs: CROWD_TIMEOUT_MS,
      timeoutMessage: "Memuat peta kepadatan timeout. Coba lagi.",
    });
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new CrowdOverviewFetchError(err.message, err);
    throw new CrowdOverviewFetchError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}. Pastikan server backend jalan.`,
      err,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new CrowdOverviewFetchError("Response backend bukan JSON yang valid.", err);
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Backend mengembalikan status ${res.status}.`;
    throw new CrowdOverviewFetchError(message);
  }

  return body as CrowdOverviewStop[];
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
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_BASE_URL}/stops/search?q=${encodeURIComponent(query)}`,
      {
        signal,
        timeoutMs: STOP_SEARCH_TIMEOUT_MS,
        timeoutMessage: "Pencarian halte timeout. Coba ketik lagi.",
      },
    );
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new StopSearchError(err.message, err);
    // Cek signal.aborted langsung, bukan .name === "AbortError" — di
    // native (Hermes), fetch yang di-abort tidak selalu melempar error
    // berbentuk itu (beda dari spec Fetch web). Signal adalah fakta
    // langsung, bukan tebakan dari bentuk error yang bisa beda-beda
    // antar platform. Ditemukan lewat testing device fisik (Task App-12).
    if (signal?.aborted) throw err;
    throw new StopSearchError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}.`,
      err,
    );
  }

  if (!res.ok) {
    throw new StopSearchError(`Backend mengembalikan status ${res.status}.`);
  }

  return (await res.json()) as StopSearchResult[];
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
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/crowd-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stop_id: stopId, level }),
      timeoutMs: CROWD_TIMEOUT_MS,
      timeoutMessage: "Mengirim laporan kepadatan timeout. Coba lagi.",
    });
  } catch (err) {
    if (err instanceof RequestTimeoutError) throw new CrowdReportSubmitError(err.message, err);
    throw new CrowdReportSubmitError(
      `Tidak bisa menghubungi backend di ${API_BASE_URL}.`,
      err,
    );
  }

  if (!res.ok) {
    let message = `Backend mengembalikan status ${res.status}.`;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "message" in body) {
        message = String((body as { message?: unknown }).message);
      }
    } catch {
      // body bukan JSON — pakai pesan default di atas.
    }
    throw new CrowdReportSubmitError(message);
  }
}
