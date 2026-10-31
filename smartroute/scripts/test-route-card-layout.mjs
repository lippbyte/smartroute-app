// Hari 4: uji tata letak kartu Hasil Rute (rentang "92–106 mnt") di layar
// sempit dan dengan nama lokasi sangat panjang — di browser sungguhan.
//
//   node scripts/test-route-card-layout.mjs [webUrl] [screenshotDir]
//
// Butuh: web Metro (bawaan http://localhost:8097, EXPO_PUBLIC_API_BASE_URL ke
// backend :3000), backend + OTP2 hidup, Chrome/Edge terpasang. Chrome
// headless dikendalikan lewat Chrome DevTools Protocol (WebSocket bawaan
// Node) — tanpa paket tambahan. Skenario S1 Blok M -> Kota pada jam terkunci
// (sama dengan baseline), jadi angkanya pasti.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const WEB = (process.argv[2] || "http://localhost:8097").replace(/\/$/, "");
const SHOTS = process.argv[3] || null;
const PORT = 9333;
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const AT = "2026-09-21T07:30:00+07:00";
const BLOK_M = "-6.2444643,106.7981332";
const KOTA = "-6.1355,106.8165";
// Urutan kartu S1 pada jam terkunci (baseline Hari 3): rentang yang harus tampil.
const EXPECTED_RANGES = ["92–106 mnt", "75–87 mnt", "64–74 mnt", "74–86 mnt"];
const LONG_ORIGIN =
  "Jalan Jenderal Sudirman Kavling Lima Puluh Dua Sampai Lima Puluh Tiga Kawasan Bisnis Terpadu Senayan Kebayoran Baru, Jakarta Selatan, Daerah Khusus Ibukota Jakarta";
const LONG_DEST =
  "Stasiun Jakarta Kota Peron Utara Dekat Pintu Keluar Museum Bank Indonesia Dan Kawasan Kota Tua Bersejarah, Taman Sari, Jakarta Barat";

let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

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
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`CDP tidak menjawab: ${url}`);
}

// Klien CDP minimal di atas WebSocket bawaan Node.
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    close: () => ws.close(),
  };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
}

async function waitFor(cdp, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Pengukuran di halaman: overflow horizontal, teks rentang terpotong, dan
// baris asal/tujuan di header.
const MEASURE = `(() => {
  const vw = window.innerWidth;
  const all = [...document.querySelectorAll("div")];
  const leaf = (re) => all.filter((el) => re.test(el.textContent) && ![...el.children].some((c) => re.test(c.textContent)));
  const rangeEls = leaf(/\\d+–\\d+ mnt/);
  const ranges = rangeEls.map((el) => (el.textContent.match(/\\d+–\\d+ mnt/) || [""])[0]);
  const clipped = rangeEls.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > vw + 0.5).length;
  // Hanya elemen BERTEKS: dekorasi latar tanpa teks boleh melebar karena
  // dipotong induknya (scrollWidth halaman tetap = viewport, dicek terpisah).
  const offEls = [...document.querySelectorAll("div")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed" && el.textContent.trim() !== "";
  });
  const offscreen = offEls.length;
  const offText = [...new Set(offEls.map((el) => {
    const r = el.getBoundingClientRect();
    return \`[\${Math.round(r.left)}..\${Math.round(r.right)}] "\${el.textContent.trim().slice(0, 40)}"\`;
  }))].slice(0, 6);
  const text = document.body.innerText;
  return {
    vw,
    scrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    ranges,
    clipped,
    offscreen,
    offText,
    hasMurah: /Murah/.test(text),
    hasCepat: /\\bCepat\\b/.test(text),
    oldSingle: /(^|\\s)(92|75|64|74) mnt/.test(text),
    hasError: /Tidak bisa|tidak tersedia|terlalu lama/.test(text),
  };
})()`;

const HEADER = `((needle) => {
  const vw = window.innerWidth;
  const el = [...document.querySelectorAll("div")].find((d) => d.textContent.startsWith(needle) && d.children.length === 0);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return { right: r.right, vw, height: r.height, lineHeight: lh, overflowHidden: el.scrollWidth > el.clientWidth };
})`;

const url = (origin, dest) =>
  `${WEB}/route?${new URLSearchParams({ origin, destination: dest, originCoord: BLOK_M, destinationCoord: KOTA, departureTime: AT })}`;

let cdp;
try {
  await json(`http://127.0.0.1:${PORT}/json/version`);
  const target = await json(`http://127.0.0.1:${PORT}/json/new?about:blank`, "PUT");
  cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // Tamu (lewati layar Masuk): AsyncStorage web = localStorage.
  await cdp.send("Page.navigate", { url: WEB });
  await waitFor(cdp, "document.readyState === 'complete'", 60_000);
  await evaluate(cdp, "localStorage.setItem('smartroute.guestChosen.v1', '1'), true");

  const cases = [
    { name: "320 px", width: 320, origin: "Blok M", dest: "Kota" },
    { name: "360 px", width: 360, origin: "Blok M", dest: "Kota" },
    { name: "412 px", width: 412, origin: "Blok M", dest: "Kota" },
    { name: "320 px + nama sangat panjang", width: 320, origin: LONG_ORIGIN, dest: LONG_DEST, long: true },
  ];
  for (const c of cases) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: c.width, height: 820, deviceScaleFactor: 2, mobile: true });
    await cdp.send("Page.navigate", { url: url(c.origin, c.dest) });
    const ready = await waitFor(cdp, `(document.body.innerText.match(/\\d+–\\d+ mnt/g) || []).length >= 4 || /Tidak bisa|tidak tersedia|terlalu lama/.test(document.body.innerText)`, 90_000);
    await new Promise((r) => setTimeout(r, 1500)); // animasi masuk kartu selesai
    const m = await evaluate(cdp, MEASURE);
    if (SHOTS) {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(path.join(SHOTS, `kartu-${c.width}${c.long ? "-panjang" : ""}.png`), Buffer.from(shot.data, "base64"));
    }
    check(`${c.name}: hasil termuat tanpa galat`, ready && !m.hasError, ready ? "" : "waktu habis");
    check(`${c.name}: kartu menampilkan rentang, urutan sama dengan baseline`, JSON.stringify(m.ranges.slice(0, 4)) === JSON.stringify(EXPECTED_RANGES), m.ranges.join(" | "));
    check(`${c.name}: tidak ada lagi menit tunggal di kartu`, !m.oldSingle);
    check(`${c.name}: label tetap dari nilai lama (#1 "Murah", tidak ada "Cepat")`, m.hasMurah && !m.hasCepat);
    check(`${c.name}: tanpa scroll horizontal`, m.scrollW <= m.vw && m.bodyScrollW <= m.vw, `scrollWidth ${m.scrollW}/${m.bodyScrollW}, viewport ${m.vw}`);
    check(`${c.name}: teks rentang tidak terpotong`, m.clipped === 0, `terpotong ${m.clipped}`);
    check(`${c.name}: tidak ada teks kartu yang keluar layar`, m.offscreen === 0, m.offscreen ? `${m.offscreen} elemen: ${m.offText.join(" | ")}` : "0");
    if (c.long) {
      for (const [label, needle] of [["asal", "Jalan Jenderal Sudirman"], ["tujuan", "Stasiun Jakarta Kota Peron"]]) {
        const h = await evaluate(cdp, `${HEADER}(${JSON.stringify(needle)})`);
        check(`${c.name}: baris ${label} di header satu baris, dipotong rapi di dalam layar`, !!h && h.right <= h.vw + 0.5 && h.height < h.lineHeight * 1.6 && h.overflowHidden, h ? `tinggi ${Math.round(h.height)} / baris ${h.lineHeight}, kanan ${Math.round(h.right)}/${h.vw}` : "tidak ditemukan");
      }
    }
  }
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  try {
    cdp?.close();
  } catch {}
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
    else browser.kill("SIGTERM");
  } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}

// Sumber: label "Cepat", filter chip, dan urutan tetap memakai nilai lama.
const src = readFileSync(new URL("../src/app/(tabs)/route/index.tsx", import.meta.url), "utf8");
check("S label 'Cepat' tetap travel_time_minutes <= 30", /if \(item\.travel_time_minutes <= 30\) return "Cepat";/.test(src));
check("S urutan tetap berdasarkan rank backend", /\.sort\(\(a, b\) => a\.rank - b\.rank\)/.test(src));
check("S kartu memakai formatRange dengan cadangan nilai tunggal", /formatRange\(item\.travel_time_range\) \?\? `\$\{item\.travel_time_minutes\} mnt`/.test(src));

const MIN = 33;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji tata letak kartu lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
