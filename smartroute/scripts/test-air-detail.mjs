// Kartu udara bisa diketuk dan layar detailnya jujur, di browser sungguhan.
//
//   node scripts/test-air-detail.mjs [webUrl] [screenshotDir]
//
// Butuh: web Metro (bawaan http://localhost:8097) dan Chrome/Edge. GET /air-quality
// dicegat lewat CDP dengan data tiruan, jadi tanpa panggilan ke IQAir: lengkap,
// tanpa cuaca, data lama, dan tidak tersedia. Tidak mengubah data apa pun.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const WEB = (process.argv[2] || "http://localhost:8097").replace(/\/$/, "");
const SHOTS = process.argv[3] || null;
const PORT = 9341;
const BROWSERS = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

const BASE = { available: true, source: "IQAir", city: "Jakarta", aqi_us: 161, category: "Tidak sehat", category_key: "tidak_sehat", pollutant_main: "PM2.5", observed_at: "2026-11-03T03:00:00.000Z", fetched_at: "2026-11-03T03:39:51.805Z", stale: false };
const WEATHER = { temp_c: 31.5, humidity_pct: 66, wind_ms: 2.5, wind_deg: 120, pressure_hpa: 1009, observed_at: "2026-11-03T03:30:00.000Z" };
const RESPONSES = {
  full: { ...BASE, weather: WEATHER },
  partial: { ...BASE, weather: { ...WEATHER, pressure_hpa: null } },
  noWeather: { ...BASE, weather: null, pollutant_main: null },
  stale: { ...BASE, stale: true, weather: WEATHER },
  off: { available: false, source: "IQAir", reason: "unavailable" },
};

let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exe = BROWSERS.find((b) => existsSync(b));
if (!exe) {
  console.log("GAGAL  Chrome/Edge tidak ditemukan");
  process.exit(1);
}
const profile = mkdtempSync(path.join(os.tmpdir(), "smartroute-cdp-"));
const browser = spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });

async function json(url, method = "GET") {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url, { method });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`CDP tidak menjawab: ${url}`);
}

try {
  await json(`http://127.0.0.1:${PORT}/json/version`);
  const target = await json(`http://127.0.0.1:${PORT}/json/new?about:blank`, "PUT");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method)(msg.params);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      // Tanpa batas waktu, satu perintah yang macet menggantung seluruh uji.
      const timer = setTimeout(() => {
        pending.delete(n);
        reject(new Error(`CDP ${method} tidak menjawab dalam 30 dtk`));
      }, 30_000);
      pending.set(n, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const waitFor = async (expression, ms = 30_000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (await ev(expression)) return true;
      await sleep(250);
    }
    return false;
  };
  const tapAt = async ({ x, y }) => {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await sleep(40);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const shot = async (name) => {
    if (!SHOTS) return;
    const s = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(SHOTS, name), Buffer.from(s.data, "base64"));
  };
  const READY = `!/Navigate Smarter/.test(document.body.innerText)`;

  let current = RESPONSES.full;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  // Hanya panggilan API: pola "*/air-quality" juga menangkap dokumen halaman itu sendiri.
  await send("Fetch.enable", { patterns: [{ urlPattern: "*:3000/air-quality" }] });
  listeners.set("Fetch.requestPaused", ({ requestId, request }) => {
    const responseHeaders = [
      { name: "Access-Control-Allow-Origin", value: "*" },
      { name: "Access-Control-Allow-Headers", value: "*" },
      { name: "Content-Type", value: "application/json" },
    ];
    if (request.method === "OPTIONS") return send("Fetch.fulfillRequest", { requestId, responseCode: 204, responseHeaders });
    return send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders, body: Buffer.from(JSON.stringify(current)).toString("base64") });
  });

  // Tamu: layar Masuk tidak menghalangi Beranda.
  await send("Page.navigate", { url: WEB });
  await waitFor("document.readyState === 'complete'", 60_000);
  await ev(`localStorage.setItem("smartroute.guestChosen.v1", "1"), true`);

  // --- Beranda: kartu bisa diketuk.
  await send("Page.navigate", { url: WEB });
  const homeOk = await waitFor(`/Udara Jakarta/.test(document.body.innerText) && ${READY}`, 60_000);
  check("D1 Beranda menampilkan kartu udara", homeOk);
  const card = await ev(`(() => { const el = document.querySelector('[aria-label^="Kualitas udara Jakarta"]'); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, role: el.getAttribute("role"), right: r.right, width: innerWidth }; })()`);
  check("D2 kartu berperan sebagai tombol, di dalam lebar layar", card?.role === "button" && card.right <= card.width, card ? `role=${card.role}, kanan ${Math.round(card.right)}/${card.width}` : "tidak ada");
  await sleep(400);
  const fresh = await ev(`(() => { const r = document.querySelector('[aria-label^="Kualitas udara Jakarta"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tapAt(fresh);
  const opened = await waitFor(`location.pathname === "/air-quality" && /Detail pengukuran/.test(document.body.innerText)`, 20_000);
  check("D3 ketuk kartu membuka layar detail", opened, await ev("location.pathname"));
  await sleep(300);
  await shot("air-detail-360.png");

  // --- Isi layar detail, data lengkap.
  const full = await ev("document.body.innerText");
  for (const [name, re] of [
    ["AQI & kategori", /161[\s\S]*Udara Jakarta: Tidak sehat/],
    ["saran umum", /Pertimbangkan rute dengan jalan kaki lebih sedikit/],
    ["polutan utama", /Polutan utama\s*PM2\.5/],
    ["waktu pengukuran dari IQAir", /Waktu pengukuran\s*3 Nov 2026, \d\d\.00/],
    ["suhu", /Suhu\s*31,5°C/],
    ["kelembapan", /Kelembapan\s*66%/],
    ["angin", /Angin\s*2,5 m\/dtk/],
    ["tekanan", /Tekanan udara\s*1009 hPa/],
    ["skala AQI", /151–200\s*Tidak sehat/],
    ["batas data jujur", /Data tingkat kota dari IQAir, bukan pengukuran per halte\. Informasi umum, bukan saran medis\./],
  ]) check(`D4 detail: ${name}`, re.test(full));
  check("D5 tautan ke situs IQAir", await ev(`[...document.querySelectorAll('[role="link"]')].some((a) => /Buka di situs IQAir/.test(a.textContent))`));
  check("D6 tanpa klaim terlarang", !/real-time|per halte terukur|saran medis:/i.test(full));

  // --- Kategori aktif ditandai tepat satu.
  const selected = await ev(`[...document.querySelectorAll('[aria-selected="true"]')].map((e) => e.textContent)`);
  check("D7 tepat satu baris skala ditandai, sesuai kategori", selected.length === 1 && /151–200/.test(selected[0]), JSON.stringify(selected));

  // --- Variasi data: baris tanpa data tidak ditampilkan, bukan diisi tebakan.
  const visit = async (resp, re) => {
    current = resp;
    // Halaman lama juga memuat teks yang ditunggu, jadi keluar dulu dari sana.
    await send("Page.navigate", { url: "about:blank" });
    await waitFor(`location.href === "about:blank"`, 10_000);
    await send("Page.navigate", { url: `${WEB}/air-quality` });
    await waitFor(`${re}.test(document.body.innerText) && ${READY}`, 30_000);
    await sleep(200);
    return ev("document.body.innerText");
  };
  const partial = await visit(RESPONSES.partial, "/Detail pengukuran/");
  check("D8 tekanan tidak valid: barisnya tidak tampil, baris lain tetap", !/Tekanan udara/.test(partial) && /Suhu/.test(partial));
  const none = await visit(RESPONSES.noWeather, "/Detail pengukuran/");
  check("D9 tanpa cuaca & polutan: kartu cuaca dan baris polutan tidak tampil", !/Cuaca/.test(none) && !/Polutan utama/.test(none) && /AQI \(standar AS\)/.test(none));
  const stale = await visit(RESPONSES.stale, "/Detail pengukuran/");
  check("D10 data lama ditandai", /Data tidak terbaru/.test(stale));
  const off = await visit(RESPONSES.off, "/sedang tidak tersedia/");
  check("D11 tidak tersedia: pesan jelas dan tombol coba lagi", /Data kualitas udara sedang tidak tersedia/.test(off) && /Coba lagi/.test(off));
  await shot("air-detail-off.png");

  // --- Layar sempit.
  current = RESPONSES.full;
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: "about:blank" });
  await waitFor(`location.href === "about:blank"`, 10_000);
  await send("Page.navigate", { url: `${WEB}/air-quality` });
  const narrowReady = await waitFor(`/Detail pengukuran/.test(document.body.innerText) && ${READY}`, 30_000);
  await sleep(300);
  const leaves = await ev(`[...document.querySelectorAll("div")].filter((d) => d.children.length === 0 && d.textContent.trim()).length`);
  const overflow = await ev(`[...document.querySelectorAll("div")].filter((d) => d.children.length === 0 && d.textContent.trim() && d.getBoundingClientRect().right > innerWidth + 0.5).map((d) => d.textContent.slice(0, 40))`);
  check("D12 layar 320 px: layar termuat, tidak ada teks keluar tepi", narrowReady && leaves >= 20 && overflow.length === 0, overflow.join(" | ") || `0 dari ${leaves} teks`);
  await shot("air-detail-320.png");

  ws.close();
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
    else browser.kill("SIGTERM");
  } catch {}
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}

const MIN = 20;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji detail udara lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
