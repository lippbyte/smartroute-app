// Hotfix Task A: daftar pilihan lokasi harus bisa digulir dengan SENTUHAN, dan
// memilih item tetap benar — di browser sungguhan dengan gestur sentuh.
//
//   node scripts/test-location-picker-scroll.mjs [webUrl] [screenshotDir]
//
// Butuh: web Metro (bawaan http://localhost:8097, EXPO_PUBLIC_API_BASE_URL ke
// backend :3000), backend + OTP2 hidup, Chrome/Edge terpasang. Chrome headless
// dikendalikan lewat Chrome DevTools Protocol (tanpa paket tambahan). Nominatim
// di-stub (layanan pihak ketiga ber-throttle) supaya koordinat terpilih pasti;
// data halte tetap dari backend asli. Tidak mengirim laporan kepadatan apa pun.
//
// BUKAN pengganti uji HP: gestur di sini disimulasikan Chrome, bukan Android/iOS.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const WEB = (process.argv[2] || "http://localhost:8097").replace(/\/$/, "");
const SHOTS = process.argv[3] || null;
const PORT = 9335;
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
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
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method)(msg.params);
    }
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    on: (method, fn) => listeners.set(method, fn),
    close: () => ws.close(),
  };
}

let cdp;
const ev = async (expression) => {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expression, ms = 30_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await ev(expression)) return true;
    await sleep(250);
  }
  return false;
};
// Input.dispatchTouchEvent, bukan synthesizeTap/ScrollGesture: di Chrome headless
// yang terakhir hanya mengirim touchstart/touchend tanpa klik maupun gulir
// (dibuktikan lewat probe), sehingga uji akan lulus/gagal karena alatnya.
const tap = async (x, y, duration = 40) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(duration);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
// yDistance negatif = jari bergerak ke atas (menggulir ke bawah).
// Jari diam 120 ms dulu, seperti jari sungguhan sebelum mulai bergerak: RN Web
// menunda pressIn 50 ms (native 0 ms), jadi drag instan tidak mewakili native.
const touchScroll = async (x, y, yDistance) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(120);
  const steps = Math.max(6, Math.round(Math.abs(yDistance) / 15));
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (yDistance * i) / steps }] });
    await sleep(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
// Gulir sampai ujung dengan beberapa usapan pendek; jari tetap di dalam daftar.
const scrollToEnd = async (re) => {
  for (let i = 0; i < 8; i++) {
    const l = await ev(LIST(re));
    if (!l || l.scrollTop + l.clientHeight >= l.scrollHeight - 1) break;
    await touchScroll(l.x, l.bottom - 20, -(l.clientHeight - 60));
    await sleep(350);
  }
  return ev(LIST(re));
};
const shot = async (name) => {
  if (!SHOTS) return;
  const s = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(SHOTS, name), Buffer.from(s.data, "base64"));
};

// Area gulir terkecil yang memuat teks tertentu, beserta baris-barisnya.
const LIST = (re) => `(() => {
  const re = new RegExp(${JSON.stringify(re)});
  const all = [...document.querySelectorAll("div")].filter((el) => {
    const s = getComputedStyle(el);
    return /(auto|scroll)/.test(s.overflowY) && el.clientHeight > 40 && el.clientHeight < 440 && re.test(el.textContent);
  });
  const sc = all.sort((a, b) => a.clientHeight - b.clientHeight)[0];
  if (!sc) return null;
  const box = sc.getBoundingClientRect();
  const rows = [...sc.querySelectorAll('[tabindex="0"]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom };
  });
  return { scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, top: box.top, bottom: box.bottom, x: box.left + box.width / 2, y: box.top + box.height / 2, rows };
})()`;
const INPUT = (ph) => `document.querySelector('input[placeholder=${JSON.stringify(ph)}]')`;
const inputCenter = (ph) => ev(`(() => { const r = ${INPUT(ph)}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const inputValue = (ph) => ev(`${INPUT(ph)}?.value ?? null`);

async function typeInto(ph, text) {
  const c = await inputCenter(ph);
  await tap(c.x, c.y);
  await sleep(250);
  await cdp.send("Input.insertText", { text });
}
const visibleRow = (l, pick) => pick(l.rows.filter((r) => r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5));

const STUB_PLACES = [1, 2, 3, 4, 5].map((i) => ({
  display_name: `Uji Tempat ${i}, Jakarta Pusat, Jakarta, Indonesia`,
  lat: String(-6.2 - i / 1000),
  lon: String(106.8 + i / 1000),
}));

// Layar pendek (mendekati tinggi tersisa saat keyboard terbuka di Android):
// baris terakhir harus tetap bisa dicapai di dalam kartu dialog.
async function shortScreenCheck(label, re) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 420, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  const s = await scrollToEnd(re);
  const last = s ? s.rows[s.rows.length - 1] : null;
  check(`${label}: layar pendek 420 px, baris terakhir tetap terlihat di dalam daftar`, !!last && last.bottom <= s.bottom + 0.5 && last.bottom <= 420, s ? `area ${s.clientHeight}px, bawah baris ${Math.round(last?.bottom)} / bawah area ${Math.round(s.bottom)}` : "tidak ada area gulir");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  const back = await ev(LIST(re));
  if (back && back.scrollTop > 0) await ev(`(() => { const re = new RegExp(${JSON.stringify(re)}); const sc = [...document.querySelectorAll("div")].filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.clientHeight > 40 && el.clientHeight < 440 && re.test(el.textContent)).sort((a, b) => a.clientHeight - b.clientHeight)[0]; if (sc) sc.scrollTop = 0; return true; })()`);
}

async function openHome(mobile = true) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 1 });
  await cdp.send("Page.navigate", { url: WEB });
  await waitFor(`!!${INPUT("Tujuan Anda")} && !/Navigate Smarter/.test(document.body.innerText)`, 90_000);
  await sleep(500);
}

async function fieldSection() {
  await openHome();
  // --- Gulir dengan sentuhan: tidak boleh memilih apa pun.
  await typeInto("Tujuan Anda", "Monumen");
  const opened = await waitFor(`(${LIST("Uji Tempat")})?.rows.length >= 5`, 20_000);
  let l = await ev(LIST("Uji Tempat"));
  check("A1 field Tujuan: daftar saran tampil dan isinya melebihi tinggi area", opened && l && l.scrollHeight > l.clientHeight, l ? `${l.rows.length} baris, isi ${l.scrollHeight}px / area ${l.clientHeight}px` : "tidak ada area gulir");
  if (!l) return;
  await touchScroll(l.x, l.bottom - 20, -140);
  await sleep(500);
  const value = await inputValue("Tujuan Anda");
  const after = await ev(LIST("Uji Tempat"));
  await shot("field-setelah-gulir.png");
  check("A2 field Tujuan: drag sentuh TIDAK memilih item (teks tetap yang diketik)", value === "Monumen", `isi field: ${value}`);
  check("A3 field Tujuan: dropdown tetap terbuka setelah drag", !!after);
  check("A4 field Tujuan: drag sentuh benar-benar menggulir", !!after && after.scrollTop > 0, after ? `scrollTop ${after.scrollTop}` : "dropdown tertutup");
  if (!after) return;

  // --- Gulir sampai ujung, ketuk baris terakhir: item & koordinat benar.
  l = await scrollToEnd("Uji Tempat");
  const last = visibleRow(l, (rows) => rows[rows.length - 1]);
  const lastIsStub = /Uji Tempat (\d)/.exec(last?.text ?? "");
  check("A5 field Tujuan: baris terakhir bisa dicapai dengan gulir", !!last && last.text === l.rows[l.rows.length - 1].text, last?.text);
  await tap(last.x, last.y);
  await sleep(500);
  const picked = await inputValue("Tujuan Anda");
  check("A6 field Tujuan: ketuk baris memilih item yang diketuk", !!lastIsStub && picked === `Uji Tempat ${lastIsStub[1]}, Jakarta Pusat, Jakarta, Indonesia`, `isi field: ${picked}`);
  check("A7 field Tujuan: dropdown tertutup setelah memilih", !(await ev(LIST("Uji Tempat"))));

  // --- Asal: ketukan LAMA (lebih lama dari timer blur 150 ms) tetap memilih.
  await typeInto("Lokasi Anda", "Monumen");
  await waitFor(`(${LIST("Uji Tempat")})?.rows.length >= 5`, 20_000);
  l = await ev(LIST("Uji Tempat"));
  const first = visibleRow(l, (rows) => rows[0]);
  await tap(first.x, first.y, 600);
  await sleep(500);
  const originValue = await inputValue("Lokasi Anda");
  check("A8 field Dari: tahan 600 ms lalu lepas tetap memilih (balapan blur 23 Sep)", !!originValue && originValue !== "Monumen" && originValue.length > 7, `isi field: ${originValue}`);
  check("A9 field Dari: dropdown tertutup setelah memilih", !(await ev(LIST("Uji Tempat"))));

  // --- Koordinat terpilih benar-benar dipakai pencarian.
  const n = lastIsStub?.[1];
  await ev(`[...document.querySelectorAll('[aria-label="Cari rute terbaik"]')][0].scrollIntoView({ block: "center" })`);
  await sleep(300);
  const btn = await ev(`(() => { const r = document.querySelector('[aria-label="Cari rute terbaik"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tap(btn.x, btn.y);
  const moved = await waitFor(`location.pathname.startsWith("/route")`, 15_000);
  const href = await ev("location.href");
  const coord = new URL(href).searchParams.get("destinationCoord");
  check("A10 Cari Rute memakai koordinat item yang diketuk", moved && coord === `${-6.2 - n / 1000},${106.8 + n / 1000}`, `destinationCoord=${coord}`);

  // --- Perilaku lain: ketuk di luar, tombol hapus, ketik ulang.
  await openHome();
  await typeInto("Tujuan Anda", "Monumen");
  await waitFor(`(${LIST("Uji Tempat")})?.rows.length >= 5`, 20_000);
  const title = await ev(`(() => { const el = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent === "SmartRoute AI"); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tap(title.x, title.y);
  await sleep(500);
  check("A11 ketuk di luar menutup dropdown, teks tidak berubah", !(await ev(LIST("Uji Tempat"))) && (await inputValue("Tujuan Anda")) === "Monumen");
  const clearBtn = await ev(`(() => { const r = document.querySelector('[aria-label="Hapus Tujuan Anda"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tap(clearBtn.x, clearBtn.y);
  await sleep(300);
  check("A12 tombol hapus mengosongkan field dan fokus kembali", (await inputValue("Tujuan Anda")) === "" && (await ev(`document.activeElement === ${INPUT("Tujuan Anda")}`)));
  await cdp.send("Input.insertText", { text: "Monumen" });
  check("A13 ketik ulang setelah hapus: saran muncul lagi", await waitFor(`(${LIST("Uji Tempat")})?.rows.length >= 5`, 20_000));

  // --- Mouse (web desktop): klik lambat & roda mouse.
  await openHome(false);
  await typeInto("Tujuan Anda", "Monumen").catch(() => {});
  await ev(`${INPUT("Tujuan Anda")}.focus(), true`);
  await waitFor(`(${LIST("Uji Tempat")})?.rows.length >= 5`, 20_000);
  l = await ev(LIST("Uji Tempat"));
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: l.x, y: l.y, deltaX: 0, deltaY: 120 });
  await sleep(500);
  const wheel = await ev(LIST("Uji Tempat"));
  check("A14 mouse: roda menggulir, dropdown tetap terbuka", !!wheel && wheel.scrollTop > 0, wheel ? `scrollTop ${wheel.scrollTop}` : "tertutup");
  const row = wheel ? visibleRow(wheel, (rows) => rows[0]) : null;
  if (row) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: row.x, y: row.y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: row.x, y: row.y, button: "left", buttons: 1, clickCount: 1 });
    await sleep(500); // lebih lama dari timer blur 150 ms
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: row.x, y: row.y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(400);
  }
  const clicked = await inputValue("Tujuan Anda");
  check("A15 mouse: tekan 500 ms lalu lepas tetap memilih", !!clicked && clicked !== "Monumen", `isi field: ${clicked}`);
}

async function quickPickerSection() {
  await openHome();
  await ev(`[...document.querySelectorAll('[role="button"], [tabindex="0"]')].find((el) => /belum diatur/.test(el.getAttribute("aria-label") || "")).scrollIntoView({ block: "center" })`);
  await sleep(300);
  const slot = await ev(`(() => { const el = [...document.querySelectorAll('[role="button"], [tabindex="0"]')].find((e) => /belum diatur/.test(e.getAttribute("aria-label") || "")); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: el.getAttribute("aria-label") }; })()`);
  await tap(slot.x, slot.y);
  const open = await waitFor(`!!${INPUT("Cari nama lokasi...")}`, 10_000);
  check("B1 Tujuan Cepat: dialog pemilih terbuka", open, slot.label);
  if (!open) return;
  await typeInto("Cari nama lokasi...", "Monumen");
  await waitFor(`/Uji Tempat 4/.test(document.body.innerText)`, 20_000);
  await sleep(300);
  await shot("tujuan-cepat.png");
  const l = await ev(LIST("Uji Tempat"));
  check("B2 Tujuan Cepat: daftar berada di area yang bisa digulir", !!l && l.scrollHeight > l.clientHeight, l ? `${l.rows.length} baris, isi ${l.scrollHeight}px / area ${l.clientHeight}px` : "tidak ada area gulir (View biasa, baris terpotong)");
  if (!l) return;
  await shortScreenCheck("B6 Tujuan Cepat", "Uji Tempat");
  const after = await scrollToEnd("Uji Tempat");
  check("B3 Tujuan Cepat: drag sentuh menggulir", !!after && after.scrollTop > 0, after ? `scrollTop ${after.scrollTop}` : "");
  const last = after ? visibleRow(after, (rows) => rows[rows.length - 1]) : null;
  check("B4 Tujuan Cepat: baris terakhir bisa dicapai", !!last && last.text === after.rows[after.rows.length - 1].text, last?.text);
  if (!last) return;
  await tap(last.x, last.y);
  await sleep(500);
  const m = /Uji Tempat \d/.exec(last.text)?.[0];
  check("B5 Tujuan Cepat: ketuk menyimpan item yang diketuk & dialog tertutup", !(await ev(`!!${INPUT("Cari nama lokasi...")}`)) && !!m && (await ev(`document.body.innerText.includes(${JSON.stringify(m)})`)), m);
}

async function crowdSection() {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Page.navigate", { url: `${WEB}/crowd-map` });
  const ready = await waitFor(`[...document.querySelectorAll("div")].some((d) => d.children.length === 0 && d.textContent === "Lapor") && !/Navigate Smarter/.test(document.body.innerText)`, 60_000);
  check("C1 Peta Kepadatan: tombol Lapor tersedia", ready);
  if (!ready) return;
  const lapor = await ev(`(() => { const el = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent === "Lapor"); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tap(lapor.x, lapor.y);
  const open = await waitFor(`!!${INPUT("Nama halte, mis. Kalideres")}`, 10_000);
  check("C2 Lapor: dialog cari halte terbuka", open);
  if (!open) return;
  await typeInto("Nama halte, mis. Kalideres", "Monumen");
  await waitFor(`(document.body.innerText.match(/Monumen/g) || []).length >= 8`, 20_000);
  await sleep(300);
  await shot("lapor-kepadatan.png");
  const l = await ev(LIST("Monumen"));
  check("C3 Lapor: 8 hasil 'Monumen' berada di area yang bisa digulir", !!l && l.rows.length >= 8 && l.scrollHeight > l.clientHeight, l ? `${l.rows.length} baris, isi ${l.scrollHeight}px / area ${l.clientHeight}px` : "tidak ada area gulir (View biasa, baris terpotong)");
  if (!l) return;
  await shortScreenCheck("C6 Lapor", "Monumen");
  const after = await scrollToEnd("Monumen");
  const last = after ? visibleRow(after, (rows) => rows[rows.length - 1]) : null;
  check("C4 Lapor: baris terakhir bisa dicapai", !!last && last.text === after.rows[after.rows.length - 1].text && after.scrollTop > 0, after ? `scrollTop ${after.scrollTop}` : "");
  if (!last) return;
  await tap(last.x, last.y);
  // Hanya memilih halte; TIDAK menekan tingkat kepadatan (tanpa laporan terkirim).
  check("C5 Lapor: ketuk memilih halte, lanjut ke pilihan tingkat kepadatan", await waitFor(`/Seberapa padat halte ini/.test(document.body.innerText)`, 5000));
}

async function allStopsSection() {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Page.navigate", { url: `${WEB}/all-stops-map` });
  const ready = await waitFor(`!!${INPUT("Cari nama halte...")} && !/Navigate Smarter/.test(document.body.innerText)`, 90_000);
  check("D1 Peta Semua Halte: kolom cari tersedia", ready);
  if (!ready) return;
  await typeInto("Cari nama halte...", "Pasar");
  await waitFor(`(${LIST("Pasar")})?.rows.length > 10`, 15_000);
  const l = await ev(LIST("Pasar"));
  check("D2 Peta Semua Halte: lebih dari 10 opsi dalam area gulir", !!l && l.rows.length > 10 && l.scrollHeight > l.clientHeight, l ? `${l.rows.length} baris, isi ${l.scrollHeight}px / area ${l.clientHeight}px` : "tidak ada");
  if (!l) return;
  await touchScroll(l.x, l.bottom - 20, -200);
  await sleep(500);
  const after = await ev(LIST("Pasar"));
  const typed = await inputValue("Cari nama halte...");
  check("D3 Peta Semua Halte: drag sentuh TIDAK memilih item, dropdown tetap terbuka", (after?.rows.length ?? 0) > 1 && typed === "Pasar", `isi kolom: ${typed}`);
  check("D4 Peta Semua Halte: drag sentuh benar-benar menggulir", (after?.rows.length ?? 0) > 1 && after.scrollTop > 0, after ? `scrollTop ${after.scrollTop}` : "dropdown tertutup");
  if ((after?.rows.length ?? 0) < 2) return;
  const mid = visibleRow(after, (rows) => rows[Math.floor(rows.length / 2)]);
  await tap(mid.x, mid.y, 600);
  await sleep(600);
  const picked = await inputValue("Cari nama halte...");
  await shot("peta-halte-setelah-pilih.png");
  const rest = await ev(LIST("Pasar"));
  const closed = (rest?.rows.length ?? 0) < 2;
  check("D5 Peta Semua Halte: tahan 600 ms lalu lepas memilih baris itu, dropdown tertutup", closed && !!picked && picked !== "Pasar" && mid.text.includes(picked), `baris: ${mid.text} | kolom: ${picked} | sisa baris: ${rest ? rest.rows.slice(0, 3).map((r) => r.text).join(" / ") : 0}`);
}

try {
  await json(`http://127.0.0.1:${PORT}/json/version`);
  const target = await json(`http://127.0.0.1:${PORT}/json/new?about:blank`, "PUT");
  cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*nominatim.openstreetmap.org/*" }] });
  cdp.on("Fetch.requestPaused", ({ requestId, request }) => {
    const headers = [
      { name: "Access-Control-Allow-Origin", value: "*" },
      { name: "Access-Control-Allow-Headers", value: "*" },
      { name: "Content-Type", value: "application/json" },
    ];
    const isPreflight = request.method === "OPTIONS";
    cdp.send("Fetch.fulfillRequest", {
      requestId,
      responseCode: isPreflight ? 204 : 200,
      responseHeaders: headers,
      ...(isPreflight ? {} : { body: Buffer.from(JSON.stringify(STUB_PLACES)).toString("base64") }),
    });
  });
  // Tamu (lewati layar Masuk): AsyncStorage web = localStorage.
  await cdp.send("Page.navigate", { url: WEB });
  await waitFor("document.readyState === 'complete'", 60_000);
  await ev("localStorage.setItem('smartroute.guestChosen.v1', '1'), true");

  for (const [name, fn] of [["field Dari/Tujuan", fieldSection], ["Tujuan Cepat", quickPickerSection], ["Lapor Kepadatan", crowdSection], ["Peta Semua Halte", allStopsSection]]) {
    try {
      await fn();
    } catch (err) {
      failures++;
      console.log(`GAGAL  bagian '${name}' terhenti: ${err instanceof Error ? err.message : err}`);
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
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}

const MIN = 30;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji gulir pemilih lokasi lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
