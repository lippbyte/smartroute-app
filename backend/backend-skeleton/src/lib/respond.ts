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

export function tooManyRequests(res: Response, retryAfterSec: number, message: string, code = "rate_limited") {
  res.setHeader("Retry-After", String(retryAfterSec));
  return res.status(429).json({ error: code, message, retry_after_sec: retryAfterSec });
}
