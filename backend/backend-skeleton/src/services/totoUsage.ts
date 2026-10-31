// Hari 1 Task 4: batas pemakaian TOTO — melindungi kredit OpenRouter.
//
// - Per pengguna: TOTO_HOURLY_LIMIT pertanyaan per 60 menit bergulir
//   (bawaan 30). Akun demo (TOTO_DEMO_EMAILS) memakai TOTO_DEMO_HOURLY_LIMIT
//   (bawaan 100) supaya presentasi tidak terpotong.
// - Global: TOTO_DAILY_CAP pertanyaan per hari kalender WIB untuk SEMUA
//   pengguna (bawaan 300).
// - Bisa dinaikkan TANPA restart/deploy ulang: tulis data/toto-limits.json
//   di folder yang sama dengan database, mis.
//     { "daily_cap": 500, "hourly_limit": 40 }
//   File dibaca ulang tiap permintaan (di-cache per mtime) dan menimpa
//   nilai .env; hapus file untuk kembali ke .env.
// Yang dihitung adalah PERCOBAAN memanggil LLM (dicatat sebelum panggilan),
// bukan hanya yang berhasil — pendekatan konservatif untuk biaya.
// Hari 4 Task 1: percobaan yang PASTI tidak ditagih provider (lihat
// isUnbilledFailure di openRouterClient) dikembalikan ke kuota per jam
// pengguna lewat refundTotoQuota; batas global harian tetap menghitungnya.
import { statSync, readFileSync } from "node:fs";
import path from "node:path";
import { db, dbPath } from "../lib/db";

const DEFAULTS = { hourly_limit: 30, demo_hourly_limit: 100, daily_cap: 300, demo_emails: ["demo@smartroute.test"] };
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WIB_OFFSET_MS = 7 * HOUR_MS; // Asia/Jakarta, tanpa DST

export interface TotoLimits {
  hourly_limit: number;
  demo_hourly_limit: number;
  daily_cap: number;
  demo_emails: string[];
}

const positiveInt = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : undefined;
};

const emailList = (v: unknown): string[] | undefined => {
  const list = typeof v === "string" ? v.split(",") : Array.isArray(v) ? v : undefined;
  return list?.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
};

const overrideFile = () => path.join(path.dirname(dbPath), "toto-limits.json");
let cached: { mtimeMs: number; values: Partial<TotoLimits> } | null = null;

function readOverrides(): Partial<TotoLimits> {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(overrideFile()).mtimeMs;
  } catch {
    cached = null;
    return {}; // tidak ada file = pakai .env
  }
  if (cached?.mtimeMs === mtimeMs) return cached.values;
  try {
    const raw = JSON.parse(readFileSync(overrideFile(), "utf8")) as Record<string, unknown>;
    const values: Partial<TotoLimits> = {};
    const hourly = positiveInt(raw.hourly_limit);
    const demoHourly = positiveInt(raw.demo_hourly_limit);
    const daily = positiveInt(raw.daily_cap);
    const emails = emailList(raw.demo_emails);
    if (hourly) values.hourly_limit = hourly;
    if (demoHourly) values.demo_hourly_limit = demoHourly;
    if (daily) values.daily_cap = daily;
    if (emails) values.demo_emails = emails;
    cached = { mtimeMs, values };
    console.log(`[toto] batas dari ${overrideFile()}:`, values);
    return values;
  } catch (err) {
    console.warn(`[toto] ${overrideFile()} tidak valid, diabaikan:`, err instanceof Error ? err.message : err);
    cached = { mtimeMs, values: {} };
    return {};
  }
}

export function currentLimits(): TotoLimits {
  const o = readOverrides();
  return {
    hourly_limit: o.hourly_limit ?? positiveInt(process.env.TOTO_HOURLY_LIMIT) ?? DEFAULTS.hourly_limit,
    demo_hourly_limit: o.demo_hourly_limit ?? positiveInt(process.env.TOTO_DEMO_HOURLY_LIMIT) ?? DEFAULTS.demo_hourly_limit,
    daily_cap: o.daily_cap ?? positiveInt(process.env.TOTO_DAILY_CAP) ?? DEFAULTS.daily_cap,
    demo_emails: o.demo_emails ?? emailList(process.env.TOTO_DEMO_EMAILS) ?? DEFAULTS.demo_emails,
  };
}

function startOfWibDay(now: number): number {
  return Math.floor((now + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS;
}

export type TotoQuota =
  | { allowed: true; usageId: number }
  | { allowed: false; reason: "daily_cap_reached" | "hourly_limit_reached"; limit: number; retryAfterSec: number };

/**
 * Cek batas lalu catat satu percobaan bila diizinkan. Tanpa `await` di
 * antara cek dan catat (node:sqlite sinkron), jadi dua permintaan
 * bersamaan tidak bisa sama-sama lolos melewati batas.
 */
export function consumeTotoQuota(userId: string, email: string, now: number = Date.now()): TotoQuota {
  const limits = currentLimits();

  const dayStart = startOfWibDay(now);
  const daily = (db.prepare("SELECT COUNT(*) AS c FROM toto_usage WHERE asked_at >= ?").get(dayStart) as { c: number }).c;
  if (daily >= limits.daily_cap) {
    return { allowed: false, reason: "daily_cap_reached", limit: limits.daily_cap, retryAfterSec: Math.ceil((dayStart + DAY_MS - now) / 1000) };
  }

  const hourly = limits.demo_emails.includes(email.toLowerCase()) ? limits.demo_hourly_limit : limits.hourly_limit;
  const row = db
    .prepare("SELECT COUNT(*) AS c, MIN(asked_at) AS oldest FROM toto_usage WHERE user_id = ? AND asked_at > ? AND refunded = 0")
    .get(userId, now - HOUR_MS) as { c: number; oldest: number | null };
  if (row.c >= hourly) {
    return { allowed: false, reason: "hourly_limit_reached", limit: hourly, retryAfterSec: Math.ceil(((row.oldest ?? now) + HOUR_MS - now) / 1000) };
  }

  const inserted = db.prepare("INSERT INTO toto_usage (user_id, asked_at) VALUES (?, ?)").run(userId, now);
  // Bersih-bersih ringan: baris > 2 hari tidak dipakai batas mana pun.
  db.prepare("DELETE FROM toto_usage WHERE asked_at < ?").run(now - 2 * DAY_MS);
  return { allowed: true, usageId: Number(inserted.lastInsertRowid) };
}

/** Kembalikan satu percobaan ke kuota per jam pengguna (bukan harian). */
export function refundTotoQuota(usageId: number): void {
  db.prepare("UPDATE toto_usage SET refunded = 1 WHERE rowid = ?").run(usageId);
}
