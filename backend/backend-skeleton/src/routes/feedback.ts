// Hari 3 Task 4: POST /feedback — form "Tentang & Masukan" di app.
// - Login opsional: token valid -> ditautkan ke akun; tanpa/token tak berlaku
//   -> tamu (tidak ditolak).
// - Validasi: kategori terbatas, pesan 1-500 karakter.
// - Rate limit 5 per 10 menit, berkunci AKUN bila login, IP bila tamu
//   (pengguna di balik satu IP tunnel tidak saling mengunci bila login).
// - Disimpan di SQLite; IP tidak disimpan. client_ref = kirim ulang draf
//   tidak dobel.
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { optionalUserId } from "../lib/auth";
import { db } from "../lib/db";
import { SlidingWindowLimiter } from "../lib/rateLimit";
import { invalidRequest, tooManyRequests } from "../lib/respond";
import { FeedbackRequestSchema } from "../lib/validation";

const router = Router();
const feedbackLimiter = new SlidingWindowLimiter(5, 10 * 60 * 1000);

router.post("/feedback", (req, res) => {
  const parsed = FeedbackRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Periksa kembali isian masukan.");
  const { category, message, client_ref, app_version } = parsed.data;
  const userId = optionalUserId(req);

  // Kirim ulang draf yang sama -> kembalikan entri lama, tanpa memakan kuota.
  if (client_ref) {
    const existing = db.prepare("SELECT id, created_at FROM feedback WHERE client_ref = ?").get(client_ref) as
      | { id: string; created_at: string }
      | undefined;
    if (existing) return res.status(200).json({ id: existing.id, created_at: existing.created_at, linked_to_account: !!userId });
  }

  const limit = feedbackLimiter.hit(userId ? `user:${userId}` : `ip:${req.ip ?? "unknown"}`);
  if (!limit.allowed) {
    return tooManyRequests(res, limit.retryAfterSec, "Terlalu banyak masukan dalam waktu singkat. Coba lagi beberapa menit lagi.");
  }

  try {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      "INSERT INTO feedback (id, user_id, client_ref, category, message, app_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, userId, client_ref ?? null, category, message, app_version ?? null, createdAt);
    return res.status(201).json({ id, created_at: createdAt, linked_to_account: !!userId });
  } catch (err) {
    console.error("Unexpected error in POST /feedback:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

export default router;
