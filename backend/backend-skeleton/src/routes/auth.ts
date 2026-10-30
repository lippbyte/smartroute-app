// Hari 1 Task 1: daftar, masuk, keluar. Akun opsional — /routes dan
// endpoint inti lain tetap publik; tamu bisa memakai semua fitur inti.
import { Router } from "express";
import { burnPasswordCheck, createSession, deleteSession, hashPassword, requireAuth, verifyPassword } from "../lib/auth";
import { SlidingWindowLimiter } from "../lib/rateLimit";
import { invalidRequest, tooManyRequests } from "../lib/respond";
import { LoginRequestSchema, RegisterRequestSchema } from "../lib/validation";
import { createUser, EmailTakenError, findUserForLogin, getUserById } from "../services/users";

const router = Router();

// Login: 10 KEGAGALAN/menit per pasangan IP+email. Login berhasil tidak
// dihitung (dan menghapus hitungan gagal pasangan itu). Berkunci IP+email,
// bukan IP saja, supaya banyak pengguna di balik satu IP (tunnel, NAT
// kampus/kantor) tidak saling mengunci. Konsekuensinya: menebak satu
// password ke banyak email dari satu IP tidak dibatasi di sini —
// TODO:verifikasi perlu tidaknya batas longgar per IP sebelum produksi.
const loginLimiter = new SlidingWindowLimiter(10, 60 * 1000);
const registerLimiter = new SlidingWindowLimiter(10, 60 * 1000);

const loginKey = (ip: string | undefined, email: string) => `${ip ?? "unknown"}|${email.trim().toLowerCase()}`;

// Sama persis untuk "email tidak terdaftar" dan "kata sandi salah".
const LOGIN_FAILED_MESSAGE = "Email atau kata sandi salah.";

router.post("/auth/register", async (req, res) => {
  const limit = registerLimiter.hit(req.ip ?? "unknown");
  if (!limit.allowed) {
    return tooManyRequests(res, limit.retryAfterSec, "Terlalu banyak percobaan daftar. Coba lagi sebentar lagi.");
  }

  const parsed = RegisterRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Periksa kembali isian pendaftaran.");
  const { email, password, name, preferences, accessibility } = parsed.data;

  try {
    const user = createUser({
      email,
      name,
      passwordHash: await hashPassword(password),
      preferences,
      accessibilityNeeds: accessibility?.needs,
    });
    const session = createSession(user.id);
    return res.status(201).json({ ...session, user });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      // TODO:verifikasi — pendaftaran mau tidak mau mengungkap bahwa email
      // sudah dipakai; menutupnya butuh verifikasi email (di luar cakupan
      // Hari 1). Login tetap tidak membocorkannya.
      return res.status(409).json({
        error: "email_unavailable",
        message: "Email ini tidak bisa dipakai untuk mendaftar. Coba masuk, atau gunakan email lain.",
        fields: { email: "Email ini tidak bisa dipakai untuk mendaftar." },
      });
    }
    console.error("Unexpected error in POST /auth/register:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginRequestSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Email dan kata sandi wajib diisi.");

  // Dicek SEBELUM password diperiksa: selama terkunci, password benar pun
  // ditolak — kalau tidak, penebak tetap mendapat jawaban benar/salah.
  const key = loginKey(req.ip, parsed.data.email);
  const limit = loginLimiter.check(key);
  if (!limit.allowed) {
    return tooManyRequests(res, limit.retryAfterSec, "Terlalu banyak percobaan masuk. Coba lagi dalam 1 menit.");
  }

  try {
    const found = findUserForLogin(parsed.data.email);
    const ok = found
      ? await verifyPassword(parsed.data.password, found.passwordHash)
      : (await burnPasswordCheck(parsed.data.password), false);
    if (!found || !ok) {
      loginLimiter.record(key);
      return res.status(401).json({ error: "invalid_credentials", message: LOGIN_FAILED_MESSAGE });
    }
    loginLimiter.reset(key);
    const session = createSession(found.id);
    return res.status(200).json({ ...session, user: getUserById(found.id) });
  } catch (err) {
    console.error("Unexpected error in POST /auth/login:", err);
    return res.status(500).json({ error: "internal_error", message: "Terjadi kesalahan internal." });
  }
});

router.post("/auth/logout", requireAuth, (_req, res) => {
  deleteSession(res.locals.token as string);
  return res.status(204).end();
});

export default router;
