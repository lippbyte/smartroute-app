// src/services/apiClient.ts
//
// Hari 1 Task 2: pemanggil backend untuk endpoint akun/riwayat/rating.
// Pola timeout sama dengan service lain (fetchWithTimeout), ditambah:
// - galat seragam (ApiError) yang membawa pesan per field dari backend,
//   supaya form bisa menampilkannya di bawah field yang salah;
// - kalau server menolak token (401), AuthContext diberi tahu lewat
//   onSessionInvalid supaya pengguna diarahkan ke layar Masuk dengan pesan
//   jelas, bukan gagal diam-diam di layar mana pun yang sedang terbuka.
//
// Hari 4 Task 1: SATU-SATUNYA tempat pemetaan galat ke pesan pengguna —
// dipakai layar lama (rute, kepadatan, halte) maupun baru. Jaringan putus,
// waktu habis, balasan bukan JSON (mis. halaman galat tunnel ngrok saat
// backend/agen mati), dan 5xx -> pesan generik; detail teknis (URL, status)
// hanya ke console. Pesan 4xx dari backend (validasi) tetap diteruskan.
import { fetchWithTimeout, RequestTimeoutError } from "@/utils/withTimeout";
import { API_BASE_URL } from "./apiConfig";

const DEFAULT_TIMEOUT_MS = 10_000;

export const NETWORK_ERROR_MESSAGE =
  "Tidak bisa menghubungi server. Periksa koneksi internet Anda, lalu coba lagi.";
export const UNAVAILABLE_MESSAGE = "Layanan sedang tidak tersedia. Coba lagi sebentar lagi.";

export class ApiError extends Error {
  constructor(
    message: string,
    /** 0 = tidak sampai ke server (jaringan putus / waktu habis). */
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

type SessionInvalidHandler = (code: "session_expired" | "unauthorized") => void;
let sessionInvalidHandler: SessionInvalidHandler | null = null;

/** Dipasang sekali oleh AuthProvider. */
export function setSessionInvalidHandler(handler: SessionInvalidHandler | null): void {
  sessionInvalidHandler = handler;
}

interface RequestOptions {
  token?: string | null;
  body?: unknown;
  timeoutMs?: number;
  /** Pesan bila waktu habis, menjelaskan operasinya ("Masuk...", "Menyimpan..."). */
  timeoutMessage: string;
  /** Pembatalan oleh pemanggil (mis. pengguna lanjut mengetik). Galat
   *  pembatalan diteruskan apa adanya, bukan dipetakan. */
  signal?: AbortSignal;
}

export async function apiRequest<T>(method: string, path: string, options: RequestOptions): Promise<T> {
  const { token, body, timeoutMs = DEFAULT_TIMEOUT_MS, timeoutMessage, signal } = options;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      signal,
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Tunnel ngrok gratis menyisipkan halaman peringatan HTML untuk
        // klien yang tampak seperti browser (app web) — header ini melewatinya.
        "ngrok-skip-browser-warning": "1",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      timeoutMs,
      timeoutMessage,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // dibatalkan pemanggil — bukan galat
    if (err instanceof RequestTimeoutError) {
      console.warn(`[api] ${method} ${path}: waktu habis setelah ${timeoutMs} ms`);
      throw new ApiError(err.message, 0, "timeout");
    }
    console.warn(`[api] ${method} ${API_BASE_URL}${path}: tidak terjangkau`, err);
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, "network");
  }

  if (res.status === 204) return undefined as T;

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    // Bukan JSON: halaman galat tunnel (502 saat backend mati di balik
    // ngrok, 404 "endpoint offline" saat agen ngrok mati) atau proxy lain —
    // bagi pengguna itu sama dengan server tidak terjangkau, apa pun
    // statusnya. Detail hanya ke console.
    console.warn(`[api] ${method} ${API_BASE_URL}${path}: balasan bukan JSON (HTTP ${res.status})`);
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, "bad_response");
  }

  if (!res.ok) {
    const b = (parsed ?? {}) as { error?: string; message?: string; fields?: Record<string, string> };
    const code = b.error ?? "http_error";
    if (res.status === 401 && token && (code === "session_expired" || code === "unauthorized")) {
      sessionInvalidHandler?.(code);
    }
    if (res.status >= 500) {
      // 5xx: pesan backend sudah generik (Hari 4), tapi pesan cadangan pun
      // tidak boleh memuat status/URL.
      console.warn(`[api] ${method} ${path}: HTTP ${res.status} ${code}`);
      throw new ApiError(b.message || UNAVAILABLE_MESSAGE, res.status, code);
    }
    throw new ApiError(b.message ?? "Permintaan tidak bisa diproses. Coba lagi.", res.status, code, b.fields ?? {});
  }

  return parsed as T;
}
