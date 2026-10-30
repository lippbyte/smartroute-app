// Hari 2 Task 2: uji GET /air-quality TANPA memanggil IQAir sungguhan.
//
//   node scripts/test-air-quality.mjs
//
// Instance backend kedua (port 3102, DB sementara) dengan IQAIR_URL ke
// provider tiruan yang MENGHITUNG setiap panggilan masuk. Cache & jeda
// dipercepat lewat AIR_QUALITY_CACHE_MS / AIR_QUALITY_RETRY_MS (khusus uji).
// Membuktikan: belum pernah sukses -> available:false (bukan 500); sukses ->
// data + kategori AQI AS; panggilan berulang dalam masa cache -> tidak ada
// panggilan baru; kunci salah / provider mati -> stale:true; pagar
// pemakaian tidak pernah melewati 4 panggilan per menit; tanpa token -> 200.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const BASE = "http://127.0.0.1:3102";
const tmp = mkdtempSync(path.join(os.tmpdir(), "smartroute-aqi-uji-"));
const CACHE_MS = 3000;
const RETRY_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// --- Provider IQAir tiruan.
let mode = "down"; // "ok" | "bad_key" | "down"
let aqi = 85;
const calls = []; // waktu tiap panggilan masuk
let sawKeyInQuery = false;
const stub = http.createServer((req, res) => {
  calls.push(Date.now());
  const q = new URL(req.url, "http://x").searchParams;
  sawKeyInQuery ||= q.get("key") === "uji-bukan-kunci-asli" && q.get("city") === "Jakarta";
  if (mode === "down") return req.socket.destroy();
  if (mode === "bad_key") {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "fail", data: { message: "incorrect_api_key" } }));
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "success", data: { city: "Jakarta", current: { pollution: { ts: "2026-10-30T09:00:00.000Z", aqius: aqi, mainus: "p2" } } } }));
});
await new Promise((r) => stub.listen(0, "127.0.0.1", r));

const backend = spawn(process.execPath, [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: "3102",
    DB_PATH: path.join(tmp, "uji.db"),
    IQAIR_URL: `http://127.0.0.1:${stub.address().port}/v2/city`,
    IQAIR_API_KEY: "uji-bukan-kunci-asli",
    AIR_QUALITY_CACHE_MS: String(CACHE_MS),
    AIR_QUALITY_RETRY_MS: String(RETRY_MS),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
backend.stdout.on("data", (d) => (log += d));
backend.stderr.on("data", (d) => (log += d));

const get = async () => {
  const r = await fetch(`${BASE}/air-quality`);
  return { status: r.status, json: await r.json() };
};

try {
  for (const deadline = Date.now() + 60_000; ; ) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`backend uji tidak siap:\n${log}`);
    await sleep(500);
  }

  // 1. Belum pernah sukses + provider mati -> available:false, bukan 500.
  const a1 = await get();
  check("A1 belum pernah sukses + provider mati -> 200 available:false", a1.status === 200 && a1.json.available === false, JSON.stringify(a1.json));
  const a1b = await get();
  check("A2 jeda setelah gagal: permintaan berikutnya tidak memanggil ulang", a1b.json.available === false && calls.length === 1, `panggilan=${calls.length}`);

  // 2. Sukses -> data & kategori.
  mode = "ok";
  await sleep(RETRY_MS + 100);
  const a3 = await get();
  check(
    "A3 sukses -> aqi_us, kategori AQI AS, polutan, fetched_at, stale:false, source IQAir",
    a3.json.available === true && a3.json.aqi_us === 85 && a3.json.category === "Sedang" && a3.json.pollutant_main === "PM2.5" && a3.json.stale === false && a3.json.source === "IQAir" && !!a3.json.fetched_at,
    `${a3.json.aqi_us} ${a3.json.category}`,
  );
  check("A4 kunci dikirim ke provider (query) — dan tidak muncul di respons", sawKeyInQuery && !JSON.stringify(a3.json).includes("uji-bukan-kunci-asli"));
  const beforeBurst = calls.length;
  const burst = await Promise.all(Array.from({ length: 10 }, get));
  check("A5 10 permintaan bersamaan dalam masa cache -> 0 panggilan baru", burst.every((b) => b.json.aqi_us === 85) && calls.length === beforeBurst, `panggilan tetap ${calls.length}`);

  // 3. Cache kedaluwarsa + kunci salah -> nilai terakhir, stale:true.
  mode = "bad_key";
  await sleep(CACHE_MS + 100);
  const a6 = await get();
  check("A6 kunci salah -> 200, nilai terakhir dengan stale:true", a6.status === 200 && a6.json.available === true && a6.json.stale === true && a6.json.fetched_at === a3.json.fetched_at, `stale=${a6.json.stale}`);

  // 4. Provider mati -> tetap stale:true.
  mode = "down";
  await sleep(RETRY_MS + 100);
  const a7 = await get();
  check("A7 provider mati -> 200, stale:true", a7.status === 200 && a7.json.stale === true);

  // 5. Pagar: sejauh ini 4 panggilan dalam < 60 dtk; spam berikutnya tidak
  //    boleh menghasilkan panggilan ke-5.
  mode = "ok";
  aqi = 160;
  const before = calls.length;
  for (let i = 0; i < 8; i++) {
    await sleep(RETRY_MS + 50);
    await get();
  }
  const inLastMinute = calls.filter((t) => t > Date.now() - 60_000).length;
  check("A8 pagar pemakaian: tidak pernah > 4 panggilan per 60 dtk", inLastMinute <= 4, `${before} sebelum spam, ${calls.length} sesudah, ${inLastMinute} dalam 60 dtk`);
  const a9 = await get();
  check("A9 saat pagar menahan panggilan -> tetap 200 dengan nilai terakhir (stale)", a9.status === 200 && a9.json.available === true && a9.json.stale === true);

  // 6. Kategori: ambang AQI AS.
  const { categorize } = await import(`file:///${path.join(ROOT, "src", "services", "airQuality.ts").replace(/\\/g, "/")}`).catch(() => ({}));
  if (categorize) {
    const cases = [[50, "Baik"], [51, "Sedang"], [100, "Sedang"], [101, "Tidak sehat bagi kelompok sensitif"], [151, "Tidak sehat"], [201, "Sangat tidak sehat"], [301, "Berbahaya"]];
    const wrong = cases.filter(([v, label]) => categorize(v).label !== label);
    check("A10 ambang kategori AQI AS (50/51/100/101/151/201/301)", wrong.length === 0, wrong.map(([v]) => v).join(",") || "7 batas");
  }
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  try {
    execSync(`taskkill /PID ${backend.pid} /T /F`, { stdio: "ignore" });
  } catch {}
  stub.close();
  stub.closeAllConnections?.();
  await sleep(800);
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

check("A11 kunci tidak pernah tercetak di log backend", !log.includes("uji-bukan-kunci-asli"));
console.log(failures === 0 ? "\nSemua uji kualitas udara lulus." : `\n${failures} uji GAGAL.\n--- log ---\n${log.slice(-2000)}`);
process.exitCode = failures ? 1 : 0;
