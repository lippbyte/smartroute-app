// Hari 4 Task 2: preflight demo — satu perintah sebelum gladi/demo.
//
//   node scripts/demo-preflight.mjs            (dari backend/backend-skeleton)
//
// Opsi (untuk uji; demo cukup tanpa opsi):
//   --backend <url>   bawaan http://localhost:<PORT dari .env, atau 3000>
//   --tunnel <url>    bawaan DEMO_TUNNEL_URL di .env (tanpa itu: WARN, dilewati)
//   --otp2 <url>      bawaan OTP2_URL di .env, atau URL bawaan kode
//   --db <file>       bawaan DB_PATH di .env, atau data/smartroute.db
//   --json <file>     simpan hasil (status per cek) sebagai JSON
//
// Keluaran: tabel PASS/WARN/FAIL; kode keluar 1 bila ada FAIL.
// TIDAK mencetak rahasia: kunci hanya "ada/tidak ada/valid/kedaluwarsa",
// password akun demo tidak pernah dicetak.
//
// Idempoten — tidak mengubah hasil skenario: tidak mengirim laporan
// kepadatan, tidak menyimpan perjalanan/rating, sesi login akun demo
// di-logout lagi di akhir. Efek samping yang disengaja: satu salinan
// cadangan database per jalan (data/backups/, di-gitignore) dan satu
// pertanyaan TOTO (satu hitungan batas per jam akun demo; dikembalikan bila
// provider pasti tidak menagih).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = /^--(.+)$/.exec(process.argv[i]);
  if (m) args[m[1]] = process.argv[i + 1]?.startsWith("--") || process.argv[i + 1] === undefined ? true : process.argv[++i];
}

const envFile = path.join(ROOT, ".env");
const env = existsSync(envFile) ? dotenv.parse(readFileSync(envFile)) : {};
const PORT = env.PORT || "3000";
const BACKEND = (args.backend || `http://localhost:${PORT}`).replace(/\/$/, "");
const TUNNEL = (args.tunnel || env.DEMO_TUNNEL_URL || "").replace(/\/$/, "") || null;
const OTP2 = args.otp2 || env.OTP2_URL || "http://localhost:8080/otp/gtfs/v1";
const DB_FILE = path.resolve(ROOT, args.db || env.DB_PATH || path.join("data", "smartroute.db"));
const BACKUP_DIR = path.join(path.dirname(DB_FILE), "backups");

// Skenario demo pada jam terkunci (sama dengan scripts/regression-routes.mjs)
// supaya hasilnya bisa dibandingkan dengan baseline Hari 3. S2 = Pasar Baru
// -> Lebak Bulus TANPA laporan Monas (laporan membalik rekomendasi).
const AT = "2026-09-21T07:30:00+07:00";
const WARMUP = [
  { id: "S1", name: "Blok M -> Kota", from: [-6.2444643, 106.7981332], to: [-6.1355, 106.8165], top: "1", baselineMs: 350 },
  { id: "S2", name: "Pasar Baru -> Lebak Bulus (tanpa Monas)", from: [-6.1622, 106.8347], to: [-6.2892744, 106.7749355], top: "2+1+M", baselineMs: 1400 },
  { id: "S3", name: "Grogol -> Kampung Melayu", from: [-6.167, 106.79], to: [-6.2244, 106.8664], top: "3+8+5C", baselineMs: 2800 },
];
// "Jauh di atas baseline": lebih dari 2,5x latensi hangat Hari 3.
const SLOW_FACTOR = 2.5;
const TOTO_QUESTION = "Dari Blok M ke Kota naik apa?";

const rows = [];
const add = (check, status, detail) => rows.push({ check, status, detail });

async function call(url, { method = "GET", token, body, timeoutMs = 15_000, headers = {} } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "1",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { ok: res.ok, status: res.status, json, ms: Date.now() - t0 };
  } catch (err) {
    const timeout = err?.name === "TimeoutError";
    // fetch Node: cause { code } atau AggregateError (IPv4/IPv6) berisi errors[].
    const code = err?.cause?.code ?? err?.cause?.errors?.find((e) => e?.code)?.code ?? err?.name ?? "galat";
    return { ok: false, status: 0, json: null, ms: Date.now() - t0, error: timeout ? `waktu habis ${timeoutMs} ms` : `tidak terjangkau (${code})` };
  }
}
const why = (r) => r.error ?? `HTTP ${r.status}${r.json?.error ? ` ${r.json.error}` : ""}`;

// --- 1. Layanan.
const health = await call(`${BACKEND}/health`, { timeoutMs: 5000 });
add("Backend lokal /health", health.ok && health.json?.status === "ok" ? "PASS" : "FAIL", health.ok ? `${health.ms} ms` : `${why(health)} — nyalakan backend: npm run dev`);

if (!TUNNEL) {
  add("Tunnel /health", "WARN", "DEMO_TUNNEL_URL belum diisi di .env — cek tunnel dilewati");
} else {
  const t = await call(`${TUNNEL}/health`, { timeoutMs: 10_000 });
  const ngrokCode = t.json ? "" : t.status === 404 ? " (agen ngrok mati?)" : t.status === 502 ? " (ngrok hidup, backend tidak terjangkau?)" : "";
  add("Tunnel /health", t.ok && t.json?.status === "ok" ? "PASS" : "FAIL", t.ok && t.json ? `${t.ms} ms` : `${why(t)}${ngrokCode} — nyalakan ngrok ke port ${PORT}`);
}

const otp = await call(OTP2, { method: "POST", body: { query: "{ feeds { feedId } }" }, timeoutMs: 10_000 });
const feeds = otp.json?.data?.feeds;
add("OTP2 (mesin rute)", otp.ok && Array.isArray(feeds) && feeds.length > 0 ? "PASS" : "FAIL", otp.ok && feeds ? `${feeds.length} feed, ${otp.ms} ms` : `${why(otp)} — nyalakan container OTP2 (Docker) lalu tunggu graph termuat`);

// --- 2. Sisa laporan kepadatan (menggeser S1/S2).
const crowd = await call(`${BACKEND}/crowd-reports`);
const activeReports = Array.isArray(crowd.json) ? crowd.json.length : null;
add(
  "Laporan kepadatan aktif",
  activeReports === 0 ? "PASS" : activeReports === null ? "FAIL" : "WARN",
  activeReports === 0 ? "0 (bersih)" : activeReports === null ? why(crowd) : `${activeReports} laporan sisa uji — S1/S2 bisa bergeser; restart backend (lihat pengingat)`,
);

// --- 3. Pemanasan rute (urutan S1, S2, S3).
const latencies = {};
for (const s of WARMUP) {
  const body = { origin: { lat: s.from[0], lng: s.from[1] }, destination: { lat: s.to[0], lng: s.to[1] }, departure_time: AT };
  let r = await call(`${BACKEND}/routes`, { method: "POST", body, timeoutMs: 60_000 });
  let note = "";
  // Panggilan pertama sesudah start bisa lambat (OTP2 dingin): ulang sekali
  // sebelum memperingatkan.
  if (r.ok && r.ms > s.baselineMs * SLOW_FACTOR) {
    const cold = r.ms;
    r = await call(`${BACKEND}/routes`, { method: "POST", body, timeoutMs: 60_000 });
    note = ` (dingin ${cold} ms)`;
  }
  latencies[s.id] = r.ms;
  if (!r.ok) {
    add(`Rute ${s.id} ${s.name}`, "FAIL", `${why(r)} — ${r.status === 502 ? "OTP2 tidak terjangkau" : "cek backend"}`);
    continue;
  }
  const top = r.json?.routes?.[0]?.route_id;
  const n = r.json?.routes?.length ?? 0;
  const slow = r.ms > s.baselineMs * SLOW_FACTOR;
  const sameTop = top === s.top;
  add(
    `Rute ${s.id} ${s.name}`,
    !sameTop ? (activeReports ? "WARN" : "FAIL") : slow ? "WARN" : "PASS",
    `${n} rute, #1 ${top ?? "-"}${sameTop ? "" : ` (baseline ${s.top})`}, ${r.ms} ms${note}${slow ? ` — jauh di atas baseline ~${s.baselineMs} ms` : ""}`,
  );
}

// --- 4. Akun demo: masuk, /me, /trips, TOTO, keluar.
const credFile = path.join(path.dirname(DB_FILE), "demo-account.local.json");
let token = null;
if (!existsSync(credFile)) {
  add("Akun demo: masuk", "FAIL", "data/demo-account.local.json tidak ada — jalankan npm run seed:demo");
} else {
  const cred = JSON.parse(readFileSync(credFile, "utf8"));
  const login = await call(`${BACKEND}/auth/login`, { method: "POST", body: { email: cred.email, password: cred.password } });
  token = login.ok ? login.json?.token : null;
  add("Akun demo: masuk", token ? "PASS" : "FAIL", token ? `${login.ms} ms` : `${why(login)} — jalankan npm run seed:demo`);
}
if (token) {
  const me = await call(`${BACKEND}/me`, { token });
  add("Akun demo: GET /me", me.ok && me.json?.email ? "PASS" : "FAIL", me.ok ? `profil terbaca${me.json?.accessibility?.needs?.length ? ", profil aksesibilitas ada" : ""}` : why(me));
  const trips = await call(`${BACKEND}/trips`, { token });
  const tripList = Array.isArray(trips.json) ? trips.json : trips.json?.trips;
  add("Akun demo: GET /trips", trips.ok && Array.isArray(tripList) ? "PASS" : "FAIL", trips.ok && Array.isArray(tripList) ? `${tripList.length} perjalanan di riwayat` : why(trips));

  const ask = await call(`${BACKEND}/assistant/ask`, { method: "POST", token, body: { question: TOTO_QUESTION }, timeoutMs: 30_000 });
  const answer = typeof ask.json?.answer === "string" ? ask.json.answer.trim() : "";
  if (ask.ok && answer.length >= 20) {
    add("TOTO: satu pertanyaan uji", "PASS", `jawaban ${answer.length} karakter, ${ask.ms} ms`);
  } else if (ask.status === 429) {
    add("TOTO: satu pertanyaan uji", "FAIL", `${ask.json?.error ?? "batas"} — ${ask.json?.message ?? ""}`.trim());
  } else {
    add("TOTO: satu pertanyaan uji", "FAIL", `${ask.ok ? "jawaban kosong/tidak valid" : why(ask)} — kunci OpenRouter: ${await openRouterKeyStatus()}`);
  }

  const out = await call(`${BACKEND}/auth/logout`, { method: "POST", token });
  add("Akun demo: keluar (tanpa sisa sesi)", out.ok ? "PASS" : "WARN", out.ok ? "sesi preflight dihapus" : why(out));
}

/** Status kunci TANPA mencetak nilainya, dengan petunjuk tindakan. */
async function openRouterKeyStatus() {
  const key = (env.OPENROUTER_API_KEY || "").trim();
  if (!key) return "TIDAK ADA — isi OPENROUTER_API_KEY di .env lalu restart backend";
  if (env.OPENROUTER_URL) return "ada (OPENROUTER_URL uji aktif di .env — hapus untuk demo)";
  const r = await call("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` }, timeoutMs: 8000 });
  if (r.ok) return "ada · VALID — cek log backend (provider/model gagal)";
  if (r.status === 401 || r.status === 403) {
    const expired = /expired/i.test(String(r.json?.error?.message ?? ""));
    return `ada · ${expired ? "KEDALUWARSA" : "DITOLAK"} — ganti kunci di .env lalu restart backend`;
  }
  return `ada · tidak bisa dicek (${why(r)})`;
}

// --- 5. Kualitas udara.
const aq = await call(`${BACKEND}/air-quality`, { timeoutMs: 15_000 });
if (!aq.ok || typeof aq.json?.available !== "boolean") {
  add("Kualitas udara", "FAIL", why(aq));
} else if (aq.json.available) {
  add("Kualitas udara", aq.json.stale ? "WARN" : "PASS", `available: true, stale: ${aq.json.stale === true}${aq.json.stale ? " — data lama ditampilkan berlabel" : ""}`);
} else {
  const reason = aq.json.reason === "not_configured" ? "IQAIR_API_KEY tidak ada" : `IQAir ${aq.json.reason ?? "tidak tersedia"}`;
  add("Kualitas udara", "WARN", `available: false, stale: false (${reason}) — kartu udara & lencana Sehat tidak tampil, tanpa galat`);
}

// --- 6. Database + salinan cadangan.
if (!existsSync(DB_FILE)) {
  add("Database", "FAIL", `${path.relative(ROOT, DB_FILE)} tidak ada`);
} else {
  try {
    const db = new DatabaseSync(DB_FILE);
    const quick = db.prepare("PRAGMA quick_check").get();
    const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    const ok = Object.values(quick)[0] === "ok";
    add("Database", ok ? "PASS" : "FAIL", `quick_check ${Object.values(quick)[0]}; ${count("users")} akun, ${count("trips")} perjalanan, ${count("sessions")} sesi`);
    mkdirSync(BACKUP_DIR, { recursive: true });
    // Cap waktu WIB (UTC+7, tanpa DST), mis. smartroute-20261031-195810.db.
    const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const backup = path.join(BACKUP_DIR, `smartroute-${stamp}.db`);
    // VACUUM INTO: salinan konsisten termasuk isi WAL, aman saat backend hidup.
    db.prepare("VACUUM INTO ?").run(backup);
    db.close();
    let ignored = false;
    try {
      execFileSync("git", ["check-ignore", "-q", backup], { cwd: ROOT, stdio: "ignore" });
      ignored = true;
    } catch {}
    add("Cadangan database", ignored ? "PASS" : "FAIL", `${path.relative(ROOT, backup)} (${Math.round(statSync(backup).size / 1024)} KB)${ignored ? ", di-gitignore" : " — TIDAK di-gitignore!"}`);
  } catch (err) {
    add("Database", "FAIL", err instanceof Error ? err.message : String(err));
  }
}

// --- Keluaran.
const W = Math.max(...rows.map((r) => r.check.length));
console.log(`\nPreflight demo SmartRoute — ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB\n`);
for (const r of rows) console.log(`${r.status.padEnd(4)}  ${r.check.padEnd(W)}  ${r.detail}`);
const n = (s) => rows.filter((r) => r.status === s).length;
console.log(`\n${n("PASS")} PASS · ${n("WARN")} WARN · ${n("FAIL")} FAIL`);
console.log(
  [
    "",
    "Pengingat:",
    "- Restart backend untuk menghapus laporan kepadatan sisa uji (laporan hanya di memori, berlaku 15 menit).",
    `  Perintah aman (HANYA proses yang mendengarkan port ${PORT}, bukan OTP2/Docker/Metro), PowerShell:`,
    `    (Get-NetTCPConnection -LocalPort ${PORT} -State Listen).OwningProcess | % { taskkill /PID $_ /T /F }`,
    "    npm run dev",
    "- Sesudah restart, jalankan preflight ini sekali lagi (memanaskan ulang OTP2 & rute).",
  ].join("\n"),
);

if (args.json) writeFileSync(path.resolve(args.json), JSON.stringify({ backend: BACKEND, tunnel: TUNNEL, latencies, rows }, null, 2));
process.exitCode = n("FAIL") ? 1 : 0;
