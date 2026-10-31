// Hari 4 Task 1: perilaku backend saat mesin rute (OTP2) tidak terjangkau.
//
//   node scripts/test-otp-down.mjs
//
// Instance backend kedua (port 3105, DB sementara) dengan OTP2_URL ke port
// mati — dari sisi backend identik dengan OTP2 yang mati, tanpa menyentuh
// container OTP2 sungguhan. Membuktikan: setiap endpoint yang bergantung
// OTP2 membalas 502 dengan kode yang sama seperti dulu dan pesan GENERIK —
// tanpa URL/host/port/nama komponen internal — sementara detail teknisnya
// tetap tercatat di log server.
import { execSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const BASE = "http://127.0.0.1:3105";
const tmp = mkdtempSync(path.join(os.tmpdir(), "smartroute-otpmati-"));
const DEAD_OTP = "http://127.0.0.1:9/otp/gtfs/v1";
const GENERIC = "Layanan rute sedang tidak tersedia. Coba lagi sebentar lagi.";
const LEAK = /https?:\/\/|localhost|127\.0\.0\.1|:\d{2,5}\b|OTP2|GraphQL|otp\/gtfs/i;

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const backend = spawn(process.execPath, [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
  cwd: ROOT,
  env: { ...process.env, PORT: "3105", DB_PATH: path.join(tmp, "uji.db"), OTP2_URL: DEAD_OTP },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
backend.stdout.on("data", (d) => (log += d));
backend.stderr.on("data", (d) => (log += d));

const S1 = { origin: { lat: -6.2444643, lng: 106.7981332 }, destination: { lat: -6.1355, lng: 106.8165 }, departure_time: "2026-09-21T07:30:00+07:00" };
const call = async (method, url, body) => {
  const r = await fetch(`${BASE}${url}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, text, json };
};

try {
  for (const deadline = Date.now() + 60_000; ; ) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`backend uji tidak siap:\n${log}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  check("O0 /health tetap 200 walau OTP2 mati", (await call("GET", "/health")).status === 200);

  // Laporan kepadatan aktif supaya GET /crowd-reports benar-benar menyentuh OTP2.
  await call("POST", "/crowd-reports", { stop_id: "1:G00753", level: "high" });
  const endpoints = [
    ["POST /routes (S1)", "POST", "/routes", S1, "otp2_unavailable"],
    ["POST /routes + aksesibilitas", "POST", "/routes", { ...S1, accessibility: ["kursi_roda"] }, "otp2_unavailable"],
    ["GET /stops/search", "GET", "/stops/search?q=Blok", null, "otp2_unavailable"],
    ["GET /stations/search", "GET", "/stations/search?q=Blok", null, "otp2_unavailable"],
    ["GET /nearby-stops", "GET", "/nearby-stops?lat=-6.2444&lng=106.7981", null, "otp2_unavailable"],
    ["GET /all-stops", "GET", "/all-stops", null, "otp2_unavailable"],
    ["GET /crowd-reports (ada laporan aktif)", "GET", "/crowd-reports", null, "otp2_unavailable"],
  ];
  for (const [name, method, url, body, code] of endpoints) {
    const r = await call(method, url, body);
    // Kode galat (`otp2_unavailable`) sengaja dipertahankan untuk klien;
    // yang diperiksa bocor/tidaknya adalah PESAN yang dilihat pengguna, dan
    // body tidak boleh memuat kunci lain (mis. detail/stack).
    check(
      `O1 ${name}: 502 '${code}', pesan generik, tanpa detail internal`,
      r.status === 502 &&
        r.json?.error === code &&
        r.json?.message === GENERIC &&
        !LEAK.test(r.json.message) &&
        JSON.stringify(Object.keys(r.json).sort()) === '["error","message"]',
      `HTTP ${r.status} ${r.text.slice(0, 120)}`,
    );
  }
  check("O2 detail teknis TETAP tercatat di log server", log.includes(DEAD_OTP) && /otp2_unavailable/.test(log));
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  try {
    execSync(`taskkill /PID ${backend.pid} /T /F`, { stdio: "ignore" });
  } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

console.log(failures === 0 ? "\nSemua uji OTP2-mati lulus." : `\n${failures} uji GAGAL.\n--- log ---\n${log.slice(-1500)}`);
process.exitCode = failures ? 1 : 0;
