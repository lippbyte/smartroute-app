// Hari 1 Task 1/7: uji endpoint akun, riwayat, rating.
//
//   node scripts/test-akun-riwayat.mjs <baseUrl> main       — uji 1-4 (+ ekstra)
//   node scripts/test-akun-riwayat.mjs <baseUrl> ratelimit  — uji 2b (jalankan
//        tepat setelah backend start: penghitung batas login ada di memori)
//   node scripts/test-akun-riwayat.mjs <baseUrl> persist    — uji 5 (setelah
//        restart backend: akun, sesi, dan riwayat dari fase main masih ada)
//
// Akun uji dibuat dengan email acak @contoh.test. Password & token TIDAK
// dicetak — disimpan hanya di data/test-accounts.local.json (di-gitignore)
// supaya fase persist bisa memakainya.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , BASE = "http://localhost:3000", PHASE = "main"] = process.argv;
const STATE_FILE = path.join(import.meta.dirname, "..", "data", "test-accounts.local.json");

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function call(method, url, { token, body, raw } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, json, text };
}

const tripBody = (label, extra = {}) => ({
  origin_label: `Uji ${label} asal`,
  destination_label: `Uji ${label} tujuan`,
  route_summary: {
    legs: [
      { mode: "Walk", from: "A", to: "B" },
      { mode: "TransJakarta", service: "1", from: "B", to: "C" },
    ],
    transfers: 0,
    walking_distance_m: 320,
  },
  predicted_min_range: { min: 92, max: 106 },
  actual_duration_min: null,
  duration_basis: "estimasi",
  fare_total: 3500,
  ...extra,
});

async function main() {
  const tag = randomBytes(4).toString("hex");
  const a = { email: `uji-a-${tag}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji A" };
  const b = { email: `uji-b-${tag}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji B" };

  // --- 1. register -> login -> /me tanpa hash password
  const regA = await call("POST", "/auth/register", {
    body: { ...a, preferences: { priority: "murah", walk_limit: "sedang", avoid_modes: ["krl"] } },
  });
  check("1a register akun A -> 201 + token", regA.status === 201 && typeof regA.json?.token === "string", `HTTP ${regA.status}`);
  check("1b respons register tanpa hash password", !/password/i.test(regA.text));
  const loginA = await call("POST", "/auth/login", { body: { email: a.email.toUpperCase(), password: a.password } });
  check("1c login akun A (email beda huruf besar) -> 200", loginA.status === 200 && !!loginA.json?.token, `HTTP ${loginA.status}`);
  const tokenA = loginA.json?.token;
  const me = await call("GET", "/me", { token: tokenA });
  check(
    "1d GET /me -> data akun A, preferensi tersimpan",
    me.status === 200 && me.json?.email === a.email && me.json?.preferences?.priority === "murah",
    `HTTP ${me.status}`,
  );
  check("1e GET /me tanpa hash password", !/password/i.test(me.text));
  const dup = await call("POST", "/auth/register", { body: a });
  check("1f daftar ulang email yang sama -> 409", dup.status === 409, `HTTP ${dup.status}`);
  const weak = await call("POST", "/auth/register", { body: { ...a, email: `x-${tag}@contoh.test`, password: "1234567" } });
  check("1g password < 8 karakter -> 400 dengan pesan field", weak.status === 400 && !!weak.json?.fields?.password, `HTTP ${weak.status}`);

  // --- 2. login salah -> 401 generik, tidak membedakan email terdaftar
  const wrongPw = await call("POST", "/auth/login", { body: { email: a.email, password: "salah-sekali-123" } });
  const noUser = await call("POST", "/auth/login", { body: { email: `tidak-ada-${tag}@contoh.test`, password: "salah-sekali-123" } });
  check("2a password salah -> 401", wrongPw.status === 401, `HTTP ${wrongPw.status}`);
  check(
    "2b email tak terdaftar -> 401 dengan pesan & kode IDENTIK",
    noUser.status === 401 && noUser.json?.message === wrongPw.json?.message && noUser.json?.error === wrongPw.json?.error,
  );

  // --- 3. trips: wajib token, hanya milik sendiri
  const noTok = await call("POST", "/trips", { body: tripBody("tanpa token") });
  check("3a POST /trips tanpa token -> 401", noTok.status === 401, `HTTP ${noTok.status}`);
  const badTok = await call("GET", "/trips", { token: "token-palsu" });
  check("3b GET /trips token palsu -> 401", badTok.status === 401, `HTTP ${badTok.status}`);
  const regB = await call("POST", "/auth/register", { body: b });
  const tokenB = regB.json?.token;
  check("3c register akun B -> 201", regB.status === 201, `HTTP ${regB.status}`);
  const ref = `ref-${tag}-0001`;
  const tripA = await call("POST", "/trips", { token: tokenA, body: tripBody("A", { client_ref: ref }) });
  check("3d POST /trips akun A -> 201", tripA.status === 201 && !!tripA.json?.id, `HTTP ${tripA.status}`);
  const tripAgain = await call("POST", "/trips", { token: tokenA, body: tripBody("A", { client_ref: ref }) });
  check("3e kirim ulang client_ref sama -> 200, id sama (tidak dobel)", tripAgain.status === 200 && tripAgain.json?.id === tripA.json?.id, `HTTP ${tripAgain.status}`);
  const tripB = await call("POST", "/trips", {
    token: tokenB,
    body: tripBody("B", { actual_duration_min: 41, duration_basis: "aktual" }),
  });
  check("3f POST /trips akun B (aktual) -> 201", tripB.status === 201, `HTTP ${tripB.status}`);
  const listA = await call("GET", "/trips", { token: tokenA });
  const listB = await call("GET", "/trips", { token: tokenB });
  check(
    "3g GET /trips A hanya berisi milik A",
    listA.status === 200 && listA.json.length === 1 && listA.json[0].id === tripA.json?.id,
    `A=${listA.json?.length} entri`,
  );
  check("3h GET /trips B hanya berisi milik B", listB.json?.length === 1 && listB.json[0].id === tripB.json?.id, `B=${listB.json?.length} entri`);
  const peek = await call("GET", `/trips/${tripA.json?.id}`, { token: tokenB });
  check("3i akun B membuka perjalanan A -> 404", peek.status === 404, `HTTP ${peek.status}`);
  const lie = await call("POST", "/trips", { token: tokenA, body: tripBody("A", { duration_basis: "aktual", actual_duration_min: null }) });
  check("3j 'aktual' tanpa durasi aktual -> 400", lie.status === 400, `HTTP ${lie.status}`);
  const lie2 = await call("POST", "/trips", { token: tokenA, body: tripBody("A", { duration_basis: "estimasi", actual_duration_min: 30 }) });
  check("3k 'estimasi' tapi diberi durasi aktual -> 400", lie2.status === 400, `HTTP ${lie2.status}`);

  // --- 4. rating
  const tid = tripA.json?.id;
  for (const stars of [0, 6, 3.5]) {
    const r = await call("POST", `/trips/${tid}/rating`, { token: tokenA, body: { stars } });
    check(`4a rating stars=${stars} -> 400`, r.status === 400, `HTTP ${r.status}`);
  }
  const noStars = await call("POST", `/trips/${tid}/rating`, { token: tokenA, body: { eta_accurate: true } });
  check("4b rating tanpa bintang -> 400", noStars.status === 400, `HTTP ${noStars.status}`);
  const longMsg = await call("POST", `/trips/${tid}/rating`, { token: tokenA, body: { stars: 4, message: "x".repeat(501) } });
  check("4c pesan 501 karakter -> 400", longMsg.status === 400 && !!longMsg.json?.fields?.message, `HTTP ${longMsg.status}`);
  const okMsg = "y".repeat(500);
  const full = await call("POST", `/trips/${tid}/rating`, {
    token: tokenA,
    body: { stars: 4, eta_accurate: true, transfer_risk_accurate: false, crowd_accurate: null, message: okMsg },
  });
  check(
    "4d rating penuh (pesan 500 karakter) -> 201, tersimpan",
    full.status === 201 && full.json?.rating?.stars === 4 && full.json?.rating?.transfer_risk_accurate === false && full.json?.rating?.message === okMsg,
    `HTTP ${full.status}`,
  );
  const again = await call("POST", `/trips/${tid}/rating`, { token: tokenA, body: { stars: 5 } });
  check("4e rating kedua untuk perjalanan sama -> 409", again.status === 409, `HTTP ${again.status}`);
  const starsOnly = await call("POST", `/trips/${tripB.json?.id}/rating`, { token: tokenB, body: { stars: 5 } });
  check("4f rating hanya bintang -> 201", starsOnly.status === 201 && starsOnly.json?.rating?.eta_accurate === null, `HTTP ${starsOnly.status}`);
  const crossRate = await call("POST", `/trips/${tid}/rating`, { token: tokenB, body: { stars: 1 } });
  check("4g akun B menilai perjalanan A -> 404", crossRate.status === 404, `HTTP ${crossRate.status}`);
  const listed = await call("GET", "/trips", { token: tokenA });
  check("4h rating terlihat di GET /trips", listed.json?.[0]?.rating?.stars === 4);

  // --- Ekstra: preferensi & aksesibilitas (Task 3) dan bentuk galat
  const prefs = await call("PUT", "/me/preferences", { token: tokenA, body: { priority: "tenang", walk_limit: "dekat", avoid_modes: [] } });
  check("E1 PUT /me/preferences -> 200", prefs.status === 200 && prefs.json?.preferences?.priority === "tenang", `HTTP ${prefs.status}`);
  const badPrefs = await call("PUT", "/me/preferences", { token: tokenA, body: { priority: "nyaman" } });
  check("E2 prioritas tidak dikenal ('nyaman') -> 400", badPrefs.status === 400, `HTTP ${badPrefs.status}`);
  const noConsent = await call("PUT", "/me/accessibility", { token: tokenA, body: { needs: ["kursi_roda"] } });
  check("E3 aksesibilitas tanpa persetujuan -> 400", noConsent.status === 400, `HTTP ${noConsent.status}`);
  const acc = await call("PUT", "/me/accessibility", { token: tokenA, body: { needs: ["kursi_roda", "lansia_anak"], consent: true } });
  check("E4 aksesibilitas + persetujuan -> 200, tersimpan", acc.status === 200 && acc.json?.accessibility?.needs?.length === 2, `HTTP ${acc.status}`);
  const del = await call("DELETE", "/me/accessibility", { token: tokenA });
  const meAfter = await call("GET", "/me", { token: tokenA });
  check("E5 hapus aksesibilitas -> null di GET /me", del.status === 200 && meAfter.json?.accessibility === null, `HTTP ${del.status}`);
  const badJson = await call("POST", "/auth/login", { raw: "{bukan json" });
  check("E6 body JSON rusak -> 400 JSON, tanpa stack trace", badJson.status === 400 && badJson.json?.error === "invalid_json" && !/at .*\.(js|ts)/.test(badJson.text), `HTTP ${badJson.status}`);
  const regAcc = await call("POST", "/auth/register", {
    body: { email: `uji-c-${tag}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji C", accessibility: { needs: ["tunarungu"], consent: true } },
  });
  check("E7 daftar dengan aksesibilitas + persetujuan -> tersimpan", regAcc.status === 201 && regAcc.json?.user?.accessibility?.needs?.[0] === "tunarungu", `HTTP ${regAcc.status}`);
  const logoutC = await call("POST", "/auth/logout", { token: regAcc.json?.token });
  const afterLogout = await call("GET", "/me", { token: regAcc.json?.token });
  check("E8 keluar mencabut token (GET /me -> 401)", logoutC.status === 204 && afterLogout.status === 401, `HTTP ${logoutC.status}/${afterLogout.status}`);

  // --- Task 3: preferensi terbaca ulang setelah keluar & masuk lagi
  const fullPrefs = { priority: "cepat", walk_limit: "jauh", avoid_modes: ["bus", "lrt"] };
  await call("PUT", "/me/preferences", { token: tokenA, body: fullPrefs });
  await call("POST", "/auth/logout", { token: tokenA });
  const relogin = await call("POST", "/auth/login", { body: { email: a.email, password: a.password } });
  const meRelogin = await call("GET", "/me", { token: relogin.json?.token });
  check(
    "T3a preferensi lengkap terbaca ulang setelah keluar & masuk lagi",
    JSON.stringify(meRelogin.json?.preferences) === JSON.stringify(fullPrefs),
    JSON.stringify(meRelogin.json?.preferences),
  );
  const tokenA2 = relogin.json?.token;
  const skipAllPrefs = await call("PUT", "/me/preferences", { token: tokenA2, body: {} });
  check("T3b preferensi kosong (onboarding dilewati) diterima -> 200", skipAllPrefs.status === 200, `HTTP ${skipAllPrefs.status}`);
  const badMode = await call("PUT", "/me/preferences", { token: tokenA2, body: { avoid_modes: ["angkot"] } });
  check("T3c moda tidak dikenal -> 400", badMode.status === 400, `HTTP ${badMode.status}`);

  // Hapus aksesibilitas benar-benar menghapus di backend: dicek langsung di
  // file database (hanya bila BASE lokal & memakai DB default).
  await call("PUT", "/me/accessibility", { token: tokenA2, body: { needs: ["low_vision"], consent: true } });
  await call("DELETE", "/me/accessibility", { token: tokenA2 });
  if (/localhost|127\.0\.0\.1/.test(BASE) && !process.env.DB_PATH) {
    const { DatabaseSync } = await import("node:sqlite");
    const dbFile = new DatabaseSync(path.join(import.meta.dirname, "..", "data", "smartroute.db"), { readOnly: true });
    const row = dbFile.prepare("SELECT accessibility_json, accessibility_consent_at FROM users WHERE email = ?").get(a.email);
    dbFile.close();
    check("T3d DELETE /me/accessibility mengosongkan kolom di database", row?.accessibility_json === null && row?.accessibility_consent_at === null);
  }

  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ a: { ...a, token: tokenA2, tripId: tripA.json?.id }, b: { ...b, token: tokenB, tripId: tripB.json?.id } }, null, 2),
  );
}

// Login dari "IP" tertentu: request lokal (loopback) dengan X-Forwarded-For
// dipercaya backend (trust proxy loopback) — mensimulasikan klien berbeda di
// balik satu tunnel.
async function loginAs(base, ip, email, password) {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "1",
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  await res.text();
  return res.status;
}

async function failNTimes(base, ip, email, n) {
  const statuses = [];
  for (let i = 0; i < n; i++) statuses.push(await loginAs(base, ip, email, "salah-sekali-123"));
  return statuses;
}

// Fase ratelimit: batas login 10 KEGAGALAN/menit per IP+email.
//   node scripts/test-akun-riwayat.mjs <baseUrl> ratelimit [tunnelUrl]
async function ratelimit() {
  const TUNNEL = process.argv[4];
  const tag = randomBytes(4).toString("hex");
  const victim = `rl-${tag}@contoh.test`;

  const s = await failNTimes(BASE, "203.0.113.10", victim, 11);
  check("2c 11 login gagal cepat (IP+email sama): 10x 401 lalu 429", s.slice(0, 10).every((x) => x === 401) && s[10] === 429, s.join(","));
  check("2d email lain dari IP yang sama tidak ikut terkunci", (await loginAs(BASE, "203.0.113.10", `lain-${tag}@contoh.test`, "x")) === 401);
  check("2e email sama dari IP lain tidak ikut terkunci", (await loginAs(BASE, "203.0.113.20", victim, "x")) === 401);

  // Akun nyata: password BENAR pun ditolak selama terkunci; login berhasil
  // tidak dihitung (12x berhasil tetap 200).
  const acct = { email: `rl-ok-${tag}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji RL" };
  await call("POST", "/auth/register", { body: acct });
  const okStatuses = [];
  for (let i = 0; i < 12; i++) okStatuses.push(await loginAs(BASE, "203.0.113.30", acct.email, acct.password));
  check("2f 12 login BERHASIL berturut-turut tidak terkena batas", okStatuses.every((x) => x === 200), okStatuses.join(","));
  await failNTimes(BASE, "203.0.113.30", acct.email, 10);
  check("2g selama terkunci, password benar pun -> 429", (await loginAs(BASE, "203.0.113.30", acct.email, acct.password)) === 429);

  // XFF palsu dari klien tidak bisa dipakai lolos: hop terakhir (yang
  // ditambahkan proxy tepercaya) yang menentukan.
  const spoofed = await failNTimes(BASE, "198.51.100.1, 203.0.113.40", `sp-${tag}@contoh.test`, 10);
  const after = await loginAs(BASE, "198.51.100.99, 203.0.113.40", `sp-${tag}@contoh.test`, "x");
  check("2h ganti entri XFF paling kiri tidak membuka kunci", spoofed.every((x) => x === 401) && after === 429, `ke-11: ${after}`);

  if (TUNNEL) {
    // Lewat tunnel sungguhan: agen ngrok menambahkan IP publik laptop ini
    // ke XFF. Kalau trust proxy salah, req.ip = 127.0.0.1 = sama dengan
    // request lokal tanpa XFF, dan email ini akan ikut terkunci di lokal.
    const viaTunnel = `tn-${tag}@contoh.test`;
    const t = await failNTimes(TUNNEL, null, viaTunnel, 11);
    check("2i lewat tunnel: 10x 401 lalu 429", t.slice(0, 10).every((x) => x === 401) && t[10] === 429, t.join(","));
    // Bukti positif: ambil X-Forwarded-For yang BENAR-BENAR diteruskan agen
    // ngrok ke backend (API inspeksi lokal agen, port 4040), lalu pastikan
    // pasangan IP itu + email itu yang terkunci.
    const inspect = await (await fetch("http://127.0.0.1:4040/api/requests/http?limit=50")).json();
    const forwardedIp = inspect.requests
      .find((r) => r.request.uri === "/auth/login")
      ?.request.headers["X-Forwarded-For"]?.[0];
    check("2j agen tunnel meneruskan X-Forwarded-For", !!forwardedIp, forwardedIp ? "ada" : "tidak ada");
    if (forwardedIp) {
      const sameClient = await loginAs(BASE, forwardedIp, viaTunnel, "x");
      check("2k kunci tunnel tercatat pada IP klien asli (IP itu + email itu -> 429)", sameClient === 429, `HTTP ${sameClient}`);
      const otherClient = await loginAs(BASE, "203.0.113.50", viaTunnel, "x");
      check("2l pengguna lain di balik tunnel yang sama tidak terkunci", otherClient === 401, `HTTP ${otherClient}`);
    }
  }
}

async function persist() {
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const me = await call("GET", "/me", { token: state.a.token });
  check("5a setelah restart: token & akun A masih berlaku", me.status === 200 && me.json?.email === state.a.email, `HTTP ${me.status}`);
  const trips = await call("GET", "/trips", { token: state.a.token });
  check(
    "5b setelah restart: riwayat + rating A masih ada",
    trips.status === 200 && trips.json?.[0]?.id === state.a.tripId && trips.json?.[0]?.rating?.stars === 4,
    `${trips.json?.length} entri`,
  );
  const tripsB = await call("GET", "/trips", { token: state.b.token });
  check("5c setelah restart: riwayat B tetap terpisah", tripsB.json?.length === 1 && tripsB.json[0].id === state.b.tripId);
}

await { main, ratelimit, persist }[PHASE]();
console.log(failures === 0 ? `\nSemua uji fase '${PHASE}' lulus.` : `\n${failures} uji GAGAL di fase '${PHASE}'.`);
// exitCode, bukan process.exit(): di Windows, exit paksa selagi soket fetch
// keep-alive menutup memicu assertion libuv (UV_HANDLE_CLOSING).
process.exitCode = failures === 0 ? 0 : 1;
