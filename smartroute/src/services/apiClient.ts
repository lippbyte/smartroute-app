// src/services/apiClient.ts
//
// Hari 1 Task 2: pemanggil backend untuk endpoint akun/riwayat/rating.
// Pola timeout sama dengan service lain (fetchWithTimeout), ditambah:
// - galat seragam (ApiError) yang membawa pesan per field dari backend,
//   supaya form bisa menampilkannya di bawah field yang salah;
// - kalau server menolak token (401), AuthContext diberi tahu lewat
//   onSessionInvalid supaya pengguna diarahkan ke layar Masuk dengan pesan
//   jelas, bukan gagal diam-diam di layar mana pun yang sedang terbuka.
import { fetchWithTimeout, RequestTimeoutError } from "@/utils/withTimeout";
import { API_BASE_URL } from "./apiConfig";

const DEFAULT_TIMEOUT_MS = 10_000;

export const NETWORK_ERROR_MESSAGE =
  "Tidak bisa menghubungi server. Periksa koneksi internet Anda, lalu coba lagi.";

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
}

export async function apiRequest<T>(method: string, path: string, options: RequestOptions): Promise<T> {
  const { token, body, timeoutMs = DEFAULT_TIMEOUT_MS, timeoutMessage } = options;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
    if (err instanceof RequestTimeoutError) throw new ApiError(err.message, 0, "timeout");
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, "network");
  }

  if (res.status === 204) return undefined as T;

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    // Bukan JSON: biasanya halaman galat tunnel (backend mati di balik
    // ngrok) — bagi pengguna itu sama dengan server tidak terjangkau.
    throw new ApiError(
      res.status >= 500 ? NETWORK_ERROR_MESSAGE : `Server mengembalikan jawaban yang tidak dikenali (${res.status}).`,
      res.status >= 500 ? 0 : res.status,
      "bad_response",
    );
  }

  if (!res.ok) {
    const b = (parsed ?? {}) as { error?: string; message?: string; fields?: Record<string, string> };
    const code = b.error ?? "http_error";
    if (res.status === 401 && token && (code === "session_expired" || code === "unauthorized")) {
      sessionInvalidHandler?.(code);
    }
    throw new ApiError(b.message ?? `Server mengembalikan status ${res.status}.`, res.status, code, b.fields ?? {});
  }

  return parsed as T;
}
