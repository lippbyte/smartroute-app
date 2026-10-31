// Hari 1: bentuk galat validasi bersama untuk endpoint akun/riwayat —
// `fields` berisi pesan per field (untuk ditampilkan di bawah field di app),
// tanpa nilai yang dikirim user (jadi password tidak pernah terpantul balik).
import type { Response } from "express";
import type { ZodError } from "zod";

export function invalidRequest(res: Response, error: ZodError, message: string) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    fields[key] ??= issue.message;
  }
  return res.status(400).json({ error: "invalid_request", message, fields });
}

// Hari 4 Task 1: 502 karena mesin rute (OTP2) tidak tersedia. Detail teknis
// (URL internal, status HTTP, galat GraphQL) HANYA ke log server; body yang
// sampai ke pengguna generik. Kode galat tetap (otp2_unavailable /
// otp2_graphql_error) supaya klien tidak berubah perilaku.
export const ROUTING_UNAVAILABLE_MESSAGE = "Layanan rute sedang tidak tersedia. Coba lagi sebentar lagi.";

export function routingUnavailable(
  res: Response,
  err: Error & { errors?: unknown },
  where: string,
  code: "otp2_unavailable" | "otp2_graphql_error",
) {
  console.error(`[${where}] ${code}: ${err.message}`, err.errors ?? "");
  return res.status(502).json({ error: code, message: ROUTING_UNAVAILABLE_MESSAGE });
}

export function tooManyRequests(res: Response, retryAfterSec: number, message: string, code = "rate_limited") {
  res.setHeader("Retry-After", String(retryAfterSec));
  return res.status(429).json({ error: code, message, retry_after_sec: retryAfterSec });
}
