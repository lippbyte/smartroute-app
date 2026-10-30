// Hari 1 Task 1: hash password & token sesi — keputusan Task 0f, tanpa
// dependency baru:
// - Password: scrypt bawaan node:crypto, salt acak 16 byte per akun,
//   dibandingkan dengan timingSafeEqual.
// - Sesi: token acak 32 byte (bukan JWT). Yang disimpan di DB hanya
//   SHA-256-nya, dengan masa berlaku. Karena tidak ada tanda tangan, tidak
//   ada rahasia server yang perlu diatur di .env; Keluar benar-benar
//   mencabut token (baris sesi dihapus).
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

const DEFAULT_SESSION_TTL_HOURS = 24 * 7;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Format: `scrypt$N$r$p$<salt base64>$<hash base64>` — parameter ikut
 *  disimpan supaya bisa dinaikkan nanti tanpa merusak hash lama. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Dipakai saat email tidak ditemukan: scrypt tetap dijalankan supaya waktu
// respons login tidak membocorkan apakah email terdaftar.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_TTL_HOURS) * 60 * 60 * 1000;
}

export function createSession(userId: string): { token: string; expires_at: string } {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlMs()).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    now.toISOString(),
    expiresAt,
  );
  return { token, expires_at: expiresAt };
}

export function deleteSession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** Hasil cek token; "expired" dibedakan dari "invalid" supaya app bisa
 *  menampilkan "Sesi Anda berakhir, silakan masuk lagi". */
function resolveSession(token: string): { userId: string } | "expired" | "invalid" {
  const row = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashToken(token)) as { user_id: string; expires_at: string } | undefined;
  if (!row) return "invalid";
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return "expired";
  }
  return { userId: row.user_id };
}

/** Middleware: wajib token. Mengisi res.locals.userId dan res.locals.token. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Silakan masuk terlebih dahulu." });
  }
  const session = resolveSession(token);
  if (session === "expired") {
    return res.status(401).json({ error: "session_expired", message: "Sesi Anda sudah berakhir. Silakan masuk lagi." });
  }
  if (session === "invalid") {
    return res.status(401).json({ error: "unauthorized", message: "Silakan masuk terlebih dahulu." });
  }
  res.locals.userId = session.userId;
  res.locals.token = token;
  next();
}

/** Hari 3 Task 4: autentikasi OPSIONAL — id pengguna bila token valid,
 *  null bila tidak ada token atau token tidak berlaku (diperlakukan sebagai
 *  tamu, bukan ditolak). */
export function optionalUserId(req: Request): string | null {
  const token = bearerToken(req);
  if (!token) return null;
  const session = resolveSession(token);
  return typeof session === "object" ? session.userId : null;
}

export function authedUserId(res: Response): string {
  return res.locals.userId as string;
}
