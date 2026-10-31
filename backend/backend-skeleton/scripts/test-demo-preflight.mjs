// Hari 4 Task 2: uji scripts/demo-preflight.mjs.
//
//   node scripts/test-demo-preflight.mjs
//
// Butuh backend utama :3000 yang BARU di-restart (tanpa laporan kepadatan)
// dan OTP2 hidup. Membuktikan:
//   1. dijalankan dua kali berturut-turut -> status setiap cek sama;
//   2. tidak meninggalkan sisa: sesi/perjalanan/rating akun demo dan
//      laporan kepadatan tidak berubah;
//   3. hasil S1/S2/S3 (/routes, jam terkunci) sesudah preflight = sebelumnya;
//   4. OTP2 mati -> FAIL jelas (instance backend kedua dengan OTP2_URL mati
//      dan salinan database — container OTP2 TIDAK disentuh);
//   5. keluaran tidak memuat password akun demo, token, atau kunci API.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const env = require("dotenv").parse(readFileSync(path.join(ROOT, ".env")));
const BASE = "http://localhost:3000";
const DB_FILE = path.join(ROOT, "data", "smartroute.db");
const cred = JSON.parse(readFileSync(path.join(ROOT, "data", "demo-account.local.json"), "utf8"));
const tmp = mkdtempSync(path.join(os.tmpdir(), "smartroute-preflight-uji-"));

let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function preflight(extra, jsonName) {
  const out = path.join(tmp, jsonName);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "demo-preflight.mjs"), "--json", out, ...extra], { cwd: ROOT, encoding: "utf8", timeout: 300_000 });
  return { code: r.status, stdout: r.stdout + r.stderr, json: existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null };
}

function routesSnapshot(file) {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "regression-routes.mjs"), BASE, file, "S1", "PB", "S3"], { cwd: ROOT, stdio: "ignore" });
  return JSON.parse(readFileSync(file, "utf8")).results;
}

function demoFootprint() {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const user = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(cred.email);
  const one = (sql) => db.prepare(sql).get(user.id).c;
  const f = {
    sessions: one("SELECT COUNT(*) c FROM sessions WHERE user_id = ?"),
    trips: one("SELECT COUNT(*) c FROM trips WHERE user_id = ?"),
    ratings: one("SELECT COUNT(*) c FROM ratings r JOIN trips t ON t.id = r.trip_id WHERE t.user_id = ?"),
  };
  db.close();
  return f;
}

const crowdCount = async () => (await (await fetch(`${BASE}/crowd-reports`)).json()).length;
const statusOf = (j) => j.rows.map((r) => `${r.check}=${r.status}`);
const topOf = (j) => j.rows.filter((r) => r.check.startsWith("Rute ")).map((r) => /#1 ([^,\s]+)/.exec(r.detail)?.[1]);

const SECRETS = [
  ["password akun demo", cred.password],
  ["OPENROUTER_API_KEY", env.OPENROUTER_API_KEY],
  ["IQAIR_API_KEY", env.IQAIR_API_KEY],
].filter(([, v]) => v && v.length >= 8);
const leaks = (text) => SECRETS.filter(([, v]) => text.includes(v)).map(([k]) => k);

let otpDown = null;
try {
  const reports0 = await crowdCount();
  check("U0 prasyarat: backend utama tanpa laporan kepadatan (baru di-restart)", reports0 === 0, `${reports0} laporan`);

  const before = routesSnapshot(path.join(tmp, "routes-before.json"));
  const foot0 = demoFootprint();

  const run1 = preflight([], "run1.json");
  const run2 = preflight([], "run2.json");
  check("U1 dua kali berturut-turut: status setiap cek sama", JSON.stringify(statusOf(run1.json)) === JSON.stringify(statusOf(run2.json)) && run1.code === run2.code, statusOf(run2.json).join(", "));
  check("U2 dua kali: rute #1 S1/S2/S3 sama dan sesuai baseline", JSON.stringify(topOf(run1.json)) === JSON.stringify(topOf(run2.json)) && JSON.stringify(topOf(run2.json)) === '["1","2+1+M","3+8+5C"]', JSON.stringify(topOf(run2.json)));
  check("U3 cakupan: 15 cek (layanan, sisa laporan, 3 rute, akun, TOTO, udara, DB, cadangan)", run1.json.rows.length === 15, `${run1.json.rows.length} cek`);
  check("U4 cek layanan & rute PASS di kondisi normal", run2.json.rows.filter((r) => /^(Backend|Tunnel|OTP2|Rute|Akun|Database|Cadangan)/.test(r.check)).every((r) => r.status === "PASS"), run2.json.rows.filter((r) => r.status !== "PASS").map((r) => `${r.check}=${r.status}`).join("; "));

  const foot1 = demoFootprint();
  const reports1 = await crowdCount();
  check("U5 tanpa sisa: sesi/perjalanan/rating akun demo tidak berubah", JSON.stringify(foot0) === JSON.stringify(foot1), `${JSON.stringify(foot0)} -> ${JSON.stringify(foot1)}`);
  check("U6 tanpa sisa: tidak ada laporan kepadatan baru", reports1 === 0, `${reports1}`);

  const after = routesSnapshot(path.join(tmp, "routes-after.json"));
  const strip = (res) => Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { http: v.http, routes: v.routes }]));
  check("U7 S1/S2/S3 sesudah preflight identik dengan sebelumnya (urutan, skor, tarif, menit, kandidat)", JSON.stringify(strip(before)) === JSON.stringify(strip(after)) && Object.keys(before).length === 3);

  check("U8 keluaran tanpa rahasia (password demo, kunci API)", leaks(run1.stdout + run2.stdout).length === 0 && SECRETS.length >= 1, leaks(run1.stdout + run2.stdout).join(", ") || `${SECRETS.length} nilai diperiksa`);
  check("U9 pengingat restart dengan perintah hanya untuk port backend", /restart backend/i.test(run1.stdout) && /Get-NetTCPConnection -LocalPort 3000 -State Listen/.test(run1.stdout));

  // --- OTP2 mati: instance kedua dengan salinan DB.
  const dbCopy = path.join(tmp, "salinan.db");
  const src = new DatabaseSync(DB_FILE);
  src.prepare("VACUUM INTO ?").run(dbCopy);
  src.close();
  otpDown = spawn(process.execPath, [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
    cwd: ROOT,
    env: { ...process.env, PORT: "3109", DB_PATH: dbCopy, OTP2_URL: "http://127.0.0.1:9/otp/gtfs/v1", OPENROUTER_URL: "http://127.0.0.1:9/v1" },
    stdio: "ignore",
  });
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch("http://127.0.0.1:3109/health")).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error("backend uji :3109 tidak siap");
    await new Promise((r) => setTimeout(r, 500));
  }
  const down = preflight(["--backend", "http://127.0.0.1:3109", "--tunnel", "http://127.0.0.1:3109", "--otp2", "http://127.0.0.1:9/otp/gtfs/v1", "--db", dbCopy], "down.json");
  const row = (name) => down.json?.rows.find((r) => r.check.startsWith(name));
  check("D1 OTP2 mati -> preflight keluar dengan kode 1", down.code === 1, `kode ${down.code}`);
  check("D2 OTP2 mati -> baris OTP2 FAIL dengan petunjuk menyalakan container", row("OTP2")?.status === "FAIL" && /nyalakan container OTP2/.test(row("OTP2")?.detail ?? ""), row("OTP2")?.detail);
  check(
    "D3 OTP2 mati -> S1, S2, S3 FAIL '502 ... OTP2 tidak terjangkau'",
    ["Rute S1", "Rute S2", "Rute S3"].every((n) => row(n)?.status === "FAIL" && /HTTP 502 otp2_unavailable — OTP2 tidak terjangkau/.test(row(n)?.detail ?? "")),
    ["Rute S1", "Rute S2", "Rute S3"].map((n) => row(n)?.detail).join(" | "),
  );
  check("D4 OTP2 mati -> backend sendiri tetap PASS (galat terlokalisasi)", row("Backend lokal")?.status === "PASS");
  check("D5 OTP2 mati -> keluaran tanpa rahasia", leaks(down.stdout).length === 0);
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  if (otpDown?.pid) {
    try {
      if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(otpDown.pid), "/T", "/F"], { stdio: "ignore" });
      else otpDown.kill("SIGTERM");
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 1000));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

const MIN = 15;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji preflight lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
