// Task B: uji layar bahasa di browser sungguhan, dengan API tiruan sepenuhnya.
//
//   node scripts/test-i18n-screens.mjs capture <keluaran.json> [--lang id|en] [--width 360] [--shots dir]
//   node scripts/test-i18n-screens.mjs parity                  (ID sekarang vs baseline)
//   node scripts/test-i18n-screens.mjs english                 (EN + layar sempit 320 px)
//   node scripts/test-i18n-screens.mjs switch                  (berganti bahasa saat app berjalan)
//   node scripts/test-i18n-screens.mjs pollutant [--shots dir] (polutan utama, ID & EN, 320 px)
//
// Berjalan melalui seluruh jalur demo lewat ketukan sungguhan: Masuk, Daftar,
// Onboarding, Beranda, Hasil Rute, Detail, Trip Pass, Navigasi, Ringkasan, Riwayat,
// Penilaian, Profil, Tentang, TOTO. Semua panggilan API dicegat lewat CDP, jadi
// tanpa LLM, tanpa OTP2, tanpa menulis data, dan tanpa kredensial asli.
//
// Baseline: scripts/test-support/i18n-id-baseline.json, direkam dari 1549e0a,
// sebelum modul bahasa ada. Layar Peta Kepadatan & Lapor Kepadatan direkam dari 16b29b9,
// sebelum layar itu diterjemahkan. Teks ID harus identik, kecuali pilihan bahasa dan
// catatan jujur di Masuk & Profil (ALLOWED_ADDITIONS).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SUPPORT = path.join(import.meta.dirname, "test-support");
const BASELINE = path.join(SUPPORT, "i18n-id-baseline.json");
const FIXTURE = JSON.parse(readFileSync(path.join(SUPPORT, "i18n-fixture-routes.json"), "utf8"));
const WEB = (process.env.WEB_URL || "http://localhost:8097").replace(/\/$/, "");
const PORT = 9343;
const BROWSERS = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const MODE = process.argv[2] ?? "parity";

// --- Data tiruan ------------------------------------------------------------
const AIR = { available: true, source: "IQAir", city: "Jakarta", aqi_us: 161, category: "Tidak sehat", category_key: "tidak_sehat", pollutant_main: "PM2.5", observed_at: "2026-11-03T03:00:00.000Z", fetched_at: "2026-11-03T03:39:51.805Z", stale: false, weather: { temp_c: 31.5, humidity_pct: 66, wind_ms: 2.5, wind_deg: 120, pressure_hpa: 1009, observed_at: "2026-11-03T03:30:00.000Z" } };
const USER = { id: "u-uji", email: "uji@contoh.test", name: "Rina", preferences: { priority: "cepat", walk_limit: "sedang", avoid_modes: ["lrt"] }, accessibility: { needs: ["kursi_roda", "lansia_anak"], consent_at: "2026-10-30T02:00:00.000Z" }, created_at: "2026-10-01T02:00:00.000Z" };
const LEGS = [{ mode: "Walk", from: "Blok M", to: "Halte Blok M" }, { mode: "TransJakarta", service: "1", from: "Halte Blok M", to: "Halte Kota" }];
const SUMMARY = { legs: LEGS, transfers: 1, walking_distance_m: 420 };
const TRIP_RATED = { id: "trip-1", created_at: "2026-10-30T10:05:00.000Z", origin_label: "Blok M", destination_label: "Kota", route_summary: SUMMARY, predicted_min_range: { min: 75, max: 87 }, actual_duration_min: 81, duration_basis: "aktual", fare_total: 3500, co2_estimate_g: 1240, rating: { stars: 4, eta_accurate: true, transfer_risk_accurate: false, crowd_accurate: null, message: "Cukup membantu.", created_at: "2026-10-30T11:00:00.000Z" } };
const TRIP_OPEN = { ...TRIP_RATED, id: "trip-2", created_at: "2026-09-12T01:30:00.000Z", origin_label: "Pasar Baru", destination_label: "Lebak Bulus", actual_duration_min: null, duration_basis: "estimasi", co2_estimate_g: null, rating: null };

const CROWD = [
  { stop_id: "1:monas", name: "Monumen Nasional 1", lat: -6.1754, lng: 106.8272, level: "high", reported_at: "2026-11-03T03:10:00.000Z" },
  { stop_id: "1:kota", name: "Halte Kota", lat: -6.1368, lng: 106.8149, level: "moderate", reported_at: "2026-11-03T02:40:00.000Z" },
  { stop_id: "1:blokm", name: "Halte Blok M", lat: -6.2444, lng: 106.7981, level: "low", reported_at: "2026-11-02T23:05:00.000Z" },
];
const CROWD_SEARCH = [
  { gtfsId: "1:monas", name: "Monumen Nasional 1", lat: -6.1754, lng: 106.8272 },
  { gtfsId: "1:monas2", name: "Monumen Nasional 2", lat: -6.1755, lng: 106.8273 },
];

function routesResponse(body) {
  const base = body.accessibility ? FIXTURE.withAccessibility : FIXTURE.plain;
  return base;
}

// --- Harness CDP ------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withBrowser(fn) {
  const exe = BROWSERS.find((b) => existsSync(b));
  if (!exe) throw new Error("Chrome/Edge tidak ditemukan");
  const profile = mkdtempSync(path.join(os.tmpdir(), "smartroute-cdp-"));
  const browser = spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });
  try {
    const json = async (url, method = "GET") => {
      for (let i = 0; i < 80; i++) {
        try {
          const r = await fetch(url, { method });
          if (r.ok) return await r.json();
        } catch {}
        await sleep(250);
      }
      throw new Error(`CDP tidak menjawab: ${url}`);
    };
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
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method)(msg.params);
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        const timer = setTimeout(() => {
          pending.delete(n);
          reject(new Error(`CDP ${method} tidak menjawab dalam 30 dtk`));
        }, 30_000);
        pending.set(n, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    const result = await fn({ send, listeners });
    ws.close();
    return result;
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
}

const COLLECT = `(() => {
  const clean = (s) => s.replace(/\\s+/g, " ").trim();
  const lines = document.body.innerText.split("\\n").map(clean).filter(Boolean);
  const attrs = new Set();
  for (const el of document.querySelectorAll("[aria-label],[placeholder]")) {
    for (const a of ["aria-label", "placeholder"]) {
      const v = el.getAttribute(a);
      if (v) attrs.add(clean(v));
    }
  }
  for (const i of document.querySelectorAll("input,textarea")) if (i.value) attrs.add("nilai: " + clean(i.value));
  const leaves = [...document.querySelectorAll("div,span")].filter((d) => d.children.length === 0 && d.textContent.trim());
  // Lebar yang diminta, bukan innerWidth: gambar latar selebar 402 px melebarkan
  // innerWidth di layar sempit, sehingga batasnya jadi longgar.
  const vw = __WIDTH__;
  const overflow = leaves.filter((d) => { const r = d.getBoundingClientRect(); return r.width > 0 && r.right > vw + 0.5; }).map((d) => clean(d.textContent).slice(0, 60));
  const clipped = leaves.filter((d) => d.scrollWidth > d.clientWidth + 1 && getComputedStyle(d).overflow !== "visible").map((d) => clean(d.textContent).slice(0, 60));
  const buttons = [...document.querySelectorAll('[role="button"],[role="link"],[role="tab"],[role="radio"]')].filter((d) => { const r = d.getBoundingClientRect(); return r.width > 0 && r.right > vw + 0.5; }).map((d) => clean(d.textContent || d.getAttribute("aria-label") || "").slice(0, 60));
  const fares = leaves.filter((d) => /^Rp \\d/.test(clean(d.textContent))).map((d) => { const r = d.getBoundingClientRect(); return { text: clean(d.textContent), right: Math.round(r.right), lines: Math.round(r.height / parseFloat(getComputedStyle(d).lineHeight || r.height)) }; });
  return { lines, attrs: [...attrs].sort(), overflow, clipped, buttons, fares };
})()`;

// Yang berubah menurut jam saat uji, bukan menurut bahasa.
const normalize = (s) => s.replace(/(Data diperbarui pada|Data updated at) \S+( [AP]M)?/g, "$1 <jam>");

async function runFlow({ lang, width, shots, scenario = "flow" }) {
  return withBrowser(async ({ send, listeners }) => {
    const screens = {};
    const collectJs = COLLECT.replace("__WIDTH__", String(width));
    const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
    const waitFor = async (expression, ms = 30_000) => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        if (await ev(expression)) return true;
        await sleep(150);
      }
      return false;
    };
    let routesMode = "ok";
    let crowdMode = "ok";
    let reportMode = "ok";
    let airOverride = null;
    const asked = [];

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Jakarta" });
    await send("Browser.grantPermissions", { permissions: ["geolocation"] });
    // Jauh dari rute: langkah navigasi tidak berpindah sendiri.
    await send("Emulation.setGeolocationOverride", { latitude: -6.9, longitude: 107.6, accuracy: 10 });
    await send("Fetch.enable", { patterns: [{ urlPattern: "*:3000/*" }, { urlPattern: "*nominatim.openstreetmap.org/*" }] });
    listeners.set("Fetch.requestPaused", ({ requestId, request }) => {
      const responseHeaders = [
        { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Access-Control-Allow-Headers", value: "*" },
        { name: "Access-Control-Allow-Methods", value: "*" },
        { name: "Content-Type", value: "application/json" },
      ];
      const reply = (body, code = 200) => send("Fetch.fulfillRequest", { requestId, responseCode: code, responseHeaders, body: Buffer.from(JSON.stringify(body)).toString("base64") });
      if (request.method === "OPTIONS") return send("Fetch.fulfillRequest", { requestId, responseCode: 204, responseHeaders });
      const url = new URL(request.url);
      if (url.hostname.includes("nominatim")) return reply(url.pathname.includes("reverse") ? {} : []);
      const body = request.postData ? JSON.parse(request.postData) : {};
      switch (true) {
        case url.pathname === "/air-quality":
          return reply(airOverride ?? AIR);
        case url.pathname === "/routes":
          if (routesMode === "error") return reply({ error: "internal", message: "Layanan rute sedang tidak tersedia. Coba lagi sebentar lagi." }, 503);
          if (routesMode === "empty") return reply({ ...FIXTURE.plain, routes: [] });
          return reply(routesResponse(body));
        case url.pathname === "/crowd-reports" && request.method === "GET":
          if (crowdMode === "error") return reply({}, 503);
          return reply(crowdMode === "empty" ? [] : CROWD);
        case url.pathname === "/crowd-reports":
          return reportMode === "error" ? reply({}, 503) : reply({ ok: true });
        case url.pathname === "/stops/search":
          return reply(/zzz/.test(url.searchParams.get("q") ?? "") ? [] : CROWD_SEARCH);
        case url.pathname === "/me":
          return reply(USER);
        case url.pathname.startsWith("/me/"):
          return reply(USER);
        case url.pathname === "/trips" && request.method === "GET":
          return reply([TRIP_RATED, TRIP_OPEN]);
        case url.pathname === "/trips" && request.method === "POST":
          return reply(TRIP_OPEN);
        case url.pathname === "/trips/trip-1":
          return reply(TRIP_RATED);
        case url.pathname === "/trips/trip-2":
          return reply(TRIP_OPEN);
        case url.pathname === "/assistant/ask":
          asked.push(body);
          return reply({ answer: "Jawaban tiruan dari TOTO.", nearby_stops: [] });
        case url.pathname === "/auth/logout":
          return reply({});
        default:
          return reply({ results: [], stops: [] });
      }
    });

    const SESSION = JSON.stringify({ token: "uji-bukan-token-asli", expires_at: "2099-01-01T00:00:00.000Z", user: USER });
    // Intro splash sudah hilang. Bukan sekadar mencari tagline: layar Tentang juga memuatnya.
    const READY = `![...document.querySelectorAll("div,span")].some((d) => d.children.length === 0 && d.textContent.trim() === "Navigate Smarter. Travel Better.")`;

    const setStorage = async (items) => {
      await send("Page.navigate", { url: `${WEB}/about` });
      await waitFor(`document.readyState === "complete"`, 60_000);
      const all = { ...items, ...(lang === "en" ? { "smartroute.language.v1": "en" } : {}) };
      await ev(`localStorage.clear(); ${Object.entries(all).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join("")} true`);
    };
    const go = async (url, marker) => {
      await send("Page.navigate", { url: "about:blank" });
      await waitFor(`location.href === "about:blank"`, 10_000);
      await send("Page.navigate", { url: `${WEB}${url}` });
      const ok = await waitFor(`${marker}.test(document.body.innerText) && ${READY}`, 40_000);
      if (!ok) throw new Error(`Layar ${url} tidak menampilkan ${marker}`);
    };
    // Elemen teks terdalam yang cocok; yang teratas di layar menang, supaya modal didahulukan.
    const BY_TEXT = (re) => `[...document.querySelectorAll("div,span")].filter((d) => d.children.length === 0 && ${re}.test(d.textContent.trim()) && d.getClientRects().length).pop()`;
    // Klik langsung pada Pressable: alat ini merekam teks. Gestur sentuh diuji
    // terpisah (test-location-picker-scroll), dan emulasi sentuh CDP tidak bertahan
    // melewati pindah halaman.
    const PRESSABLE = `'[tabindex="0"],[role="button"],[role="link"],[role="tab"],[role="radio"],[role="checkbox"],[role="switch"]'`;
    const clickOn = async (selectorJs, what) => {
      const done = await ev(`(() => { const el = ${selectorJs}; if (!el) return false; (el.closest(${PRESSABLE}) ?? el).click(); return true; })()`);
      if (!done) throw new Error(`Tidak ditemukan: ${what}`);
      await sleep(300);
    };
    const tapText = (re, name = re) => clickOn(BY_TEXT(re), name);
    const tapAria = (re, name = re) => clickOn(`[...document.querySelectorAll("[aria-label]")].filter((d) => ${re}.test(d.getAttribute("aria-label")) && d.getClientRects().length).pop()`, name);
    const shoot = async (name) => {
      if (!shots) return;
      const s = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(path.join(shots, `${name}.png`), Buffer.from(s.data, "base64"));
    };
    // Tunggu teks stabil: dua pembacaan berturut-turut sama.
    const capture = async (name) => {
      await sleep(350);
      let prev = null;
      for (let i = 0; i < 25; i++) {
        const cur = await ev(collectJs);
        const sig = JSON.stringify([cur.lines, cur.attrs]);
        if (sig === prev) break;
        prev = sig;
        await sleep(200);
      }
      const data = await ev(collectJs);
      screens[name] = { lines: data.lines.map(normalize), attrs: data.attrs.map(normalize), overflow: data.overflow, clipped: data.clipped, buttons: data.buttons, fares: data.fares };
      await shoot(name);
    };
    const waitText = async (re, ms = 20_000) => {
      if (!(await waitFor(`${re}.test(document.body.innerText)`, ms))) throw new Error(`Teks tidak muncul: ${re}`);
    };
    // Animasi "Perjalanan selesai" menutupi Ringkasan sebentar: harus tampil, lalu
    // hilang sendiri. Ringkasan baru direkam setelahnya, supaya baseline tetap utuh.
    const COMPLETE_OVERLAY = `document.querySelector('[data-testid="trip-complete-overlay"]')`;
    const settleTripComplete = async (name) => {
      if (!(await ev(`!!${COMPLETE_OVERLAY}`))) throw new Error("Animasi selesai tidak tampil");
      await shoot(`${name}-animasi`);
      if (!(await waitFor(`!${COMPLETE_OVERLAY}`, 6_000))) throw new Error("Animasi selesai tidak hilang");
    };

    const ROUTE_URL = `/route?origin=${encodeURIComponent("Stasiun MRT Blok M, Jakarta")}&destination=${encodeURIComponent("Halte TransJakarta Kota, Jakarta")}&originCoord=${encodeURIComponent("-6.2444643,106.7981332")}&destinationCoord=${encodeURIComponent("-6.136827,106.814876")}&departureTime=${encodeURIComponent("2026-09-21T07:30:00+07:00")}`;
    const RESULT_MARK = "/88–102 (mnt|min)/";
    const openFirstCard = async () => {
      await waitText(RESULT_MARK);
      await sleep(500);
      await tapText("/^88–102 (mnt|min) · 07:30/", "kartu rute pertama");
      await waitText("/Detail Perjalanan|Trip Details/");
    };

    if (scenario === "pollutant") {
      const label = lang === "en" ? "Main pollutant" : "Polutan utama";
      const CARD_RE = "/Udara Jakarta|Air in Jakarta/";
      const judge = (name, where, want) => {
        const s = screens[name];
        const cut = s.clipped.filter((c) => /pollutant|Polutan|Ozon/i.test(c));
        check(`K ${lang} ${width} px ${where}: ${want}`, s.lines.some((l) => l.includes(want)), s.lines.find((l) => /pollutant|Polutan/.test(l))?.slice(0, 70) ?? "");
        check(`K ${lang} ${width} px ${where}: tidak keluar tepi & tidak terpotong`, s.overflow.length === 0 && cut.length === 0, [...s.overflow, ...cut].slice(0, 3).join(" | "));
      };
      await setStorage({ "smartroute.guestChosen.v1": "1" });
      const NAMES = [["PM2.5", "PM2.5"], ["PM10", "PM10"], ["Ozon (O₃)", lang === "en" ? "Ozone (O₃)" : "Ozon (O₃)"], ["NO₂", "NO₂"], ["SO₂", "SO₂"], ["CO", "CO"]];
      for (const [server, shown] of NAMES) {
        airOverride = { ...AIR, pollutant_main: server };
        await go("/", CARD_RE);
        await capture(`beranda-${server}`);
        judge(`beranda-${server}`, `Beranda ${server}`, `${label} ${shown}`);
        await go("/air-quality", "/Detail pengukuran|Measurement details/");
        await capture(`udara-${server}`);
        judge(`udara-${server}`, `detail ${server}`, shown);
      }
      // Kasus terpanjang: ozon dengan kategori terpanjang, di kartu ringkas Hasil Rute.
      airOverride = { ...AIR, pollutant_main: "Ozon (O₃)", category: "Tidak sehat bagi kelompok sensitif", category_key: "sensitif" };
      const longest = lang === "en" ? "Ozone (O₃)" : "Ozon (O₃)";
      await go("/", CARD_RE);
      await capture("beranda-terpanjang");
      judge("beranda-terpanjang", "Beranda terpanjang", `${label} ${longest}`);
      await go(ROUTE_URL, RESULT_MARK);
      await sleep(600);
      await capture("rute-terpanjang");
      judge("rute-terpanjang", "Hasil Rute terpanjang", `${label} ${longest}`);
      return { screens };
    }

    if (scenario === "switch") {
      const text = () => ev("document.body.innerText");
      const pick = (label) => tapAria(`/^${label}$/`, label);
      const baseline = JSON.parse(readFileSync(BASELINE, "utf8")).screens;

      // Dari Profil: pindah bahasa tanpa keluar dari layar yang sedang dibuka.
      await setStorage({ "smartroute.guestChosen.v1": "1" });
      await go("/account", "/Akun Anda/");
      check("G1 bawaan Indonesia", /Akun Anda/.test(await text()));
      await pick("English");
      const toEn = await waitFor(`/Your Account/.test(document.body.innerText)`, 15_000);
      check("G2 pilih English di Profil: layar langsung berbahasa Inggris", toEn);
      check("G3 tetap di layar Profil", (await ev("location.pathname")) === "/account", await ev("location.pathname"));
      const tabs = await text();
      check("G4 tab ikut berganti", /Home/.test(tabs) && /Routes/.test(tabs) && /Account/.test(tabs) && !/Beranda/.test(tabs));
      check("G5 pilihan tersimpan", (await ev(`localStorage.getItem("smartroute.language.v1")`)) === "en");
      await tapAria("/^Home$/");
      check("G6 Beranda lewat tab: Inggris", await waitFor(`/Find Best Route/.test(document.body.innerText)`, 15_000));

      // Dibuka ulang.
      await go("/account", "/Your Account/");
      check("G7 pilihan bertahan setelah halaman dimuat ulang", /Your Account/.test(await text()));

      // Kembali ke Indonesia: identik dengan baseline.
      await pick("Bahasa Indonesia");
      check("G8 pilih Bahasa Indonesia: kembali Indonesia", await waitFor(`/Akun Anda/.test(document.body.innerText)`, 15_000));
      await capture("profil-tamu");
      const d = diffScreen("profil-tamu", baseline["profil-tamu"], screens["profil-tamu"]);
      check("G9 kembali ke ID: Profil identik dengan baseline", d === null, d ?? "");
      await go("/account", "/Akun Anda/");
      check("G10 pilihan ID bertahan setelah dimuat ulang", /Akun Anda/.test(await text()));

      // Hasil rute yang sudah terbuka ikut berganti, termasuk angka hasil pemanggilan fungsi.
      await go(ROUTE_URL, RESULT_MARK);
      await sleep(600);
      check("G11 hasil rute Indonesia: tarif bertitik", /Rp 3\.500/.test(await text()) && /88–102 mnt/.test(await text()));
      await tapAria("/^Akun$/");
      await waitText("/Akun Anda/");
      await pick("English");
      await waitText("/Your Account/");
      await tapAria("/^Routes$/");
      const routeEn = await waitFor(`/Route Results/.test(document.body.innerText) && /88–102 min/.test(document.body.innerText)`, 25_000);
      const routeText = await text();
      check("G12 tab Rute setelah berganti: Inggris, rute tetap ada", routeEn, routeText.split("\n").slice(0, 4).join(" | "));
      check("G13 tarif & satuan mengikuti bahasa, tanpa sisa format lama", /Rp 3,500/.test(routeText) && !/Rp 3\.500/.test(routeText) && !/\bmnt\b/.test(routeText));

      // Layar Masuk.
      await setStorage({});
      await go("/login", "/Lanjut sebagai tamu/");
      const picker = await text();
      check("G14 pilihan bahasa ada di layar Masuk", /Bahasa Indonesia/.test(picker) && /English/.test(picker));
      await pick("English");
      check("G15 pilih English di Masuk: Inggris, tetap di layar Masuk", (await waitFor(`/Continue as guest/.test(document.body.innerText)`, 15_000)) && (await ev("location.pathname")) === "/login", await ev("location.pathname"));
      await tapText("/^Continue as guest$/");
      check("G16 lanjut sebagai tamu: Beranda Inggris", await waitFor(`/Find Best Route/.test(document.body.innerText)`, 20_000));

      return { screens };
    }

    // --- 1. Belum masuk & belum memilih tamu.
    await setStorage({});
    await go("/login", "/Lanjut sebagai tamu|Continue as guest/");
    await capture("masuk");
    await tapText("/^(Masuk|Sign in)$/", "tombol Masuk");
    await waitText("/Email wajib diisi|Email is required/");
    await capture("masuk-galat");
    await go("/register", "/Nama panggilan|Nickname/");
    await capture("daftar");
    await tapText("/^(Daftar|Sign up)$/", "tombol Daftar");
    await waitText("/Nama wajib diisi|Name is required/");
    await capture("daftar-galat");

    // --- 2. Tamu.
    await setStorage({ "smartroute.guestChosen.v1": "1" });
    await go("/", "/Cari Rute Terbaik|Find Best Route/");
    await waitText("/Udara Jakarta|Air in Jakarta/");
    if (!(await waitFor(`[...document.querySelectorAll("input")].some((i) => /Lokasi Anda saat ini|Your current location/.test(i.value))`, 15_000))) throw new Error("Kolom Dari tidak terisi dari GPS");
    await capture("beranda-tamu");
    await tapAria("/Buka menu|Open menu/");
    await waitText("/Riwayat Perjalanan|Trip History/");
    await capture("menu-samping");
    await tapAria("/Tutup menu|Close menu/");
    await sleep(300);
    await tapText("/^Tap untuk atur$|^Tap to set$/", "slot Tujuan Cepat");
    await waitFor(`!!document.querySelector('[placeholder^="Cari nama lokasi"],[placeholder^="Search for a place"]')`, 8_000);
    await capture("tujuan-cepat");
    await go("/account", "/Akun Anda|Your Account/");
    await capture("profil-tamu");
    await go("/history", "/Masuk untuk melihat riwayat|Sign in to see your history/");
    await capture("riwayat-tamu");
    await go("/assistant", "/Masuk untuk memakai TOTO|Sign in to use TOTO/");
    await capture("toto-tamu");
    await go("/about", "/Transparansi data|Data transparency/");
    await capture("tentang");
    await go("/air-quality", "/Detail pengukuran|Measurement details/");
    await capture("udara");
    await go("/route", "/Belum ada pencarian rute|No route search yet/");
    await capture("rute-kosong");
    await go("/route/tidak-ada", "/Data rute sudah tidak tersedia|Route data is no longer available/");
    await capture("detail-hilang");
    await go("/trip-pass?id=tidak-ada", "/Data rute sudah tidak tersedia|Route data is no longer available/");
    await capture("trippass-hilang");
    await go("/navigate?id=tidak-ada", "/Data rute sudah tidak tersedia|Route data is no longer available/");
    await capture("navigasi-hilang");
    await go("/trip/trip-1", "/Masuk untuk melihat riwayat perjalanan|Sign in to see your trip history/");
    await capture("perjalanan-tamu");

    // --- 2b. Peta Kepadatan & Lapor Kepadatan.
    await go("/crowd-map", "/^[\\s\\S]*(Lapor|Report)/");
    await capture("peta-kepadatan");
    const popup = await ev(`(() => { const f = document.querySelector("iframe"); if (!f) return null; const m = /const points = (\\[[\\s\\S]*?\\]);\\n/.exec(f.srcdoc); return { title: f.getAttribute("title"), items: m ? JSON.parse(m[1]).map((p) => p.popupHtml.replace(/<br\\/>/g, " | ").replace(/<[^>]+>/g, "")) : [] }; })()`);
    if (!popup || popup.items.length !== CROWD.length) throw new Error("Isi popup peta tidak terbaca");
    screens["peta-popup"] = { lines: popup.items, attrs: [popup.title], overflow: [], clipped: [], buttons: [], fares: [] };
    await tapText("/^(Lapor|Report)$/", "tombol Lapor");
    await waitFor(`!!document.querySelector('input[placeholder^="Nama halte"],input[placeholder^="Stop name"]')`, 8_000);
    await capture("lapor-cari");
    const typeStop = async (text) => {
      await ev(`(() => { const i = document.querySelector('input[placeholder^="Nama halte"],input[placeholder^="Stop name"]'); i.focus(); i.select(); return true; })()`);
      await send("Input.insertText", { text });
    };
    await typeStop("Mo");
    await waitText("/Ketik minimal 3 karakter|Type at least 3 characters/");
    await capture("lapor-pendek");
    await typeStop("zzzz");
    await waitText('/Tidak ada halte untuk|No stops for/');
    await capture("lapor-kosong");
    await typeStop("Monumen");
    await waitText("/Monumen Nasional 2/");
    await capture("lapor-hasil");
    await tapText("/^Monumen Nasional 2$/", "hasil pencarian");
    await waitText("/Seberapa padat halte ini sekarang|How crowded is this stop right now/");
    await capture("lapor-tingkat");
    reportMode = "error";
    await tapText("/^(Padat|Crowded)$/", "tingkat kepadatan");
    await waitText("/Layanan sedang tidak tersedia|The service is unavailable right now/");
    await capture("lapor-galat");
    reportMode = "ok";
    crowdMode = "empty";
    await go("/crowd-map", "/Belum ada laporan kepadatan|No crowd reports right now/");
    await capture("peta-kosong");
    crowdMode = "error";
    await go("/crowd-map", "/Coba Lagi|Try Again/");
    await capture("peta-galat");
    crowdMode = "ok";

    // --- 3. Hasil rute, detail, Trip Pass, navigasi, ringkasan (tamu).
    await go(ROUTE_URL, RESULT_MARK);
    await sleep(600);
    await capture("hasil-rute");
    await tapAria("/Buka filter rute|Open route filters/");
    await waitText("/Filter Rute|Route Filters/");
    await capture("filter");
    await tapText("/^(Bus)$/", "chip Bus");
    await tapText("/^(Cepat|Fast)$/", "chip Cepat");
    await tapText("/^(Reset)$/", "tombol Reset");
    await tapAria("/^(Tutup|Close)$/");
    await sleep(500);
    await tapAria("/^Lencana |^Badge /");
    await waitText("/Heuristik sederhana|A simple heuristic/");
    await capture("lencana");
    await tapText("/^(Tutup|Close)$/", "tutup lencana");
    await sleep(300);
    await openFirstCard();
    await sleep(300);
    await capture("detail-rute");
    await tapText("/^Trip Pass$/", "tombol Trip Pass");
    await waitText("/Tarif per bagian perjalanan|Fare per trip section/");
    await capture("trip-pass");
    await tapText("/^(Cek saldo \\(simulasi\\)|Check balance \\(simulation\\))$/", "cek saldo");
    await waitText("/Saldo Rp|Balance Rp/");
    await capture("trip-pass-cek");
    await tapText("/^(Ubah saldo awal simulasi|Change simulated starting balance)$/", "ubah saldo");
    await waitText("/Saldo awal simulasi|Simulated starting balance/");
    await capture("trip-pass-ubah");
    await tapText("/^(Batal|Cancel)$/", "batal");
    await tapText("/^(Top-up \\(simulasi\\)|Top up \\(simulation\\))$/", "top-up");
    await waitText("/Top-up saldo simulasi|Top up simulated balance/");
    await capture("topup-pilih");
    await tapText("/^Rp 20[.,]000$/", "nominal");
    await waitText("/Konfirmasi top-up simulasi|Confirm simulated top-up/");
    await capture("topup-konfirmasi");
    await tapText("/^(Konfirmasi top-up simulasi|Confirm simulated top-up)$/", "konfirmasi");
    await waitText("/Saldo simulasi bertambah|Simulated balance increased/");
    await capture("topup-selesai");
    await tapText("/^(Tutup|Close)$/", "tutup top-up");
    await sleep(300);
    await tapAria("/^(Kembali|Back)$/");
    await waitText("/Mulai Navigasi|Start Navigation/");
    await sleep(300);
    await tapText("/^(Mulai Navigasi|Start Navigation)$/", "mulai navigasi");
    await waitText("/berpindah otomatis|moves automatically/");
    await capture("navigasi");
    await tapAria("/^(Daftar langkah|Step list)$/");
    await waitText("/Reliabilitas|Reliability/");
    await capture("navigasi-langkah");
    await tapAria("/^(Langkah berikutnya|Next step)$/");
    await sleep(500);
    await capture("navigasi-langkah-2");
    for (let i = 0; i < 8; i++) {
      if (await ev(`/Ringkasan Perjalanan|Trip Summary/.test(document.body.innerText)`)) break;
      await tapAria("/^(Langkah berikutnya|Next step|Selesai|Finish)$/");
      await sleep(350);
    }
    await waitText("/Ringkasan Perjalanan|Trip Summary/");
    await settleTripComplete("ringkasan-tamu");
    await capture("ringkasan-tamu");

    // --- 4. Galat & hasil kosong.
    routesMode = "error";
    await go(ROUTE_URL, "/Coba Lagi|Try Again/");
    await capture("rute-galat");
    routesMode = "empty";
    await go(ROUTE_URL, "/Tidak ada rute yang ditemukan|No routes were found/");
    await capture("rute-tanpa-hasil");
    routesMode = "ok";

    // --- 5. Bantuan aksesibilitas menyala.
    await setStorage({ "smartroute.guestChosen.v1": "1", "smartroute.assistive.v1": JSON.stringify({ showA11yInfo: true, emphasizeWalk: true, simpleNav: true, bigAlerts: true }) });
    await go(ROUTE_URL, "/Tampilkan info aksesibilitas|Show accessibility info/");
    await waitText(RESULT_MARK);
    await sleep(600);
    await capture("hasil-aksesibilitas");
    await tapAria("/Ketuk untuk rincian per halte|Tap for details per stop/");
    await waitText("/Info aksesibilitas kursi roda|Wheelchair accessibility info/");
    await capture("aksesibilitas-rincian");
    await tapText("/^(Tutup|Close)$/", "tutup rincian");
    await sleep(300);
    await openFirstCard();
    await tapText("/^(Mulai Navigasi|Start Navigation)$/", "mulai navigasi");
    await waitText("/Keluar dari navigasi|Exit navigation/");
    await capture("navigasi-sederhana");
    await tapText("/^(Langkah berikutnya|Next step)$/", "langkah berikutnya");
    await sleep(300);
    await capture("navigasi-sederhana-2");

    // --- 6. Pengguna masuk (sesi & API tiruan).
    await setStorage({ "smartroute.session.v1": SESSION });
    await go("/account", "/uji@contoh\\.test/");
    await waitText("/Blok M/");
    await capture("profil-masuk");
    await tapAria("/^(Prioritas utama|Main priority): /");
    await waitFor(`/Batal|Cancel/.test(document.body.innerText)`, 5_000);
    await capture("profil-pilih-prioritas");
    await tapText("/^(Batal|Cancel)$/", "batal");
    await sleep(350);
    await tapAria("/^(Ubah data aksesibilitas|Edit accessibility data)$/");
    await waitText("/Persetujuan|Consent/");
    await capture("profil-aksesibilitas");
    await tapText("/^(Batal|Cancel)$/", "batal");
    await sleep(300);
    await tapText("/^(Hapus data aksesibilitas|Delete accessibility data)$/", "hapus");
    await waitText("/Ya, hapus|Yes, delete/");
    await capture("profil-hapus");
    await go("/history", "/Perjalanan|Trips/");
    await waitText("/Lebak Bulus/");
    await capture("riwayat-masuk");
    await go("/trip/trip-1", "/ETA sesuai|ETA accurate/");
    await capture("perjalanan-dinilai");
    await go("/trip/trip-2", "/Beri penilaian|Rate this trip/");
    await capture("perjalanan-belum-dinilai");
    await tapText("/^(Beri penilaian|Rate this trip)$/", "beri penilaian");
    await waitText("/Seberapa membantu rute ini|How helpful was this route/");
    await capture("penilaian");
    await go("/assistant", "/Contoh pertanyaan|Example questions/");
    await waitText("/Lokasi aktif|Location on/");
    await capture("toto");
    await tapText("/^(Jam berapa TransJakarta mulai dan berhenti beroperasi\\?|What time does TransJakarta start and stop running\\?)$/", "saran TOTO");
    await waitText("/Jawaban tiruan dari TOTO/");
    await capture("toto-jawaban");
    await go("/onboarding", "/Langkah 1 dari 3|Step 1 of 3/");
    await capture("onboarding-1");
    await tapText("/^(Lanjut|Next)$/", "lanjut");
    await waitText("/Langkah 2 dari 3|Step 2 of 3/");
    await capture("onboarding-2");
    await tapText("/^(Lanjut|Next)$/", "lanjut");
    await waitText("/Langkah 3 dari 3|Step 3 of 3/");
    await capture("onboarding-3");
    await go(ROUTE_URL, RESULT_MARK);
    await openFirstCard();
    await tapText("/^(Mulai Navigasi|Start Navigation)$/", "mulai navigasi");
    await waitText("/berpindah otomatis|moves automatically/");
    for (let i = 0; i < 8; i++) {
      if (await ev(`/Ringkasan Perjalanan|Trip Summary/.test(document.body.innerText)`)) break;
      await tapAria("/^(Langkah berikutnya|Next step|Selesai|Finish)$/");
      await sleep(350);
    }
    await settleTripComplete("ringkasan-masuk");
    await waitText("/Tersimpan di Riwayat|Saved to History/");
    await capture("ringkasan-masuk");

    return { screens, asked };
  });
}

// --- Mode ------------------------------------------------------------------
let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// Tambahan yang disengaja di layar ID (keputusan dokumen Task B).
const ALLOWED_ADDITIONS = {
  masuk: ["Bahasa Indonesia", "English", "Bahasa"],
  "masuk-galat": ["Bahasa Indonesia", "English", "Bahasa"],
  "profil-tamu": ["Bahasa", "Bahasa Indonesia", "English", "Sebagian teks dari server masih berbahasa Indonesia."],
  "profil-masuk": ["Bahasa", "Bahasa Indonesia", "English", "Sebagian teks dari server masih berbahasa Indonesia."],
  "profil-pilih-prioritas": ["Bahasa", "Bahasa Indonesia", "English", "Sebagian teks dari server masih berbahasa Indonesia."],
  "profil-aksesibilitas": ["Bahasa", "Bahasa Indonesia", "English", "Sebagian teks dari server masih berbahasa Indonesia."],
  "profil-hapus": ["Bahasa", "Bahasa Indonesia", "English", "Sebagian teks dari server masih berbahasa Indonesia."],
};

function diffScreen(name, base, now) {
  const allowed = ALLOWED_ADDITIONS[name] ?? [];
  const without = (arr) => arr.filter((s) => !allowed.includes(s));
  const a = JSON.stringify(base.lines);
  const b = JSON.stringify(without(now.lines));
  const c = JSON.stringify(base.attrs);
  const d = JSON.stringify(without(now.attrs));
  if (a === b && c === d) return null;
  const onlyBase = base.lines.filter((l) => !now.lines.includes(l)).slice(0, 4);
  const onlyNow = without(now.lines).filter((l) => !base.lines.includes(l)).slice(0, 4);
  const attrBase = base.attrs.filter((l) => !now.attrs.includes(l)).slice(0, 3);
  const attrNow = without(now.attrs).filter((l) => !base.attrs.includes(l)).slice(0, 3);
  return JSON.stringify({ hilang: onlyBase, baru: onlyNow, attrHilang: attrBase, attrBaru: attrNow, urutan: a !== b && !onlyBase.length && !onlyNow.length });
}

// Kata Indonesia yang tidak boleh tersisa di teks buatan app saat EN aktif.
const ID_WORDS = /\b(lapor|laporan|padat|lengang|yang|dengan|untuk|dari|atau|dan|tidak|belum|sudah|masuk|daftar|keluar|lewati|simpan|batal|tutup|kembali|coba|lagi|halte|stasiun|jalan kaki|menit|mnt|tarif|saldo|riwayat|perjalanan|penilaian|kepadatan|akun|beranda|rute|tujuan|asal|berangkat|langkah|selesai|estimasi|aktual|sekarang|hari ini|sumber|diperbarui|ketuk|pilih|cari|memuat|menyimpan|gratis|kartu|bantuan|tampilan)\b/i;
// Teks dari server dan data uji: dibiarkan Indonesia sesuai dokumen Task B.
const SERVER_OK = [
  /Jawaban tiruan/, /^Halte /, /^Stasiun /, /Halte TransJakarta/, /Stasiun MRT/, /Blok M/, /Lebak Bulus/, /Pasar Baru/, /Cukup membantu/,
  /Monumen Nasional/, /Sebagian teks dari server/, /^Bahasa( Indonesia)?$/, /Rina/, /Layanan rute sedang tidak tersedia/,
  // Rincian tarif & ringkasan aksesibilitas dari backend.
  /titik tanpa data aksesibilitas|tercatat bisa diakses|Data aksesibilitas armada|Jalur jalan kaki belum dinilai/, /layanan premium/, /transfer gratis|Gratis transfer|gratis dalam/i,
  // Nama moda, kategori AQI, nama rute, dan nama tempat dari data.
  /Tanjungpriuk|Cikarang|Bogor|Bundaran HI|Dukuh Atas|Kota/,
];
const RAW_KEY = /\b(crowd|auth|home|route|detail|nav|trip|pass|about|toto|pref|a11y|air|common|profile|onboarding|history|rating|format|assistive|feedback|error|mode|badge|quick|side|tab|departure|location)\.[a-zA-Z0-9_.]+\b/;

if (MODE === "capture") {
  const out = process.argv[3];
  const lang = flag("lang", "id");
  const width = Number(flag("width", "360"));
  const shots = flag("shots", null);
  if (shots) mkdirSync(shots, { recursive: true });
  const { screens } = await runFlow({ lang, width, shots });
  writeFileSync(out, JSON.stringify({ lang, width, at: new Date().toISOString(), screens }, null, 1));
  console.log(`${Object.keys(screens).length} layar direkam -> ${out}`);
  const total = Object.values(screens).reduce((s, x) => s + x.lines.length + x.attrs.length, 0);
  console.log(`${total} string`);
} else if (MODE === "parity") {
  const base = JSON.parse(readFileSync(BASELINE, "utf8")).screens;
  const { screens } = await runFlow({ lang: "id", width: 360, shots: flag("shots", null) });
  check(`jumlah layar sama dengan baseline`, Object.keys(screens).length === Object.keys(base).length && Object.keys(base).length >= 40, `${Object.keys(screens).length}/${Object.keys(base).length}`);
  for (const name of Object.keys(base)) {
    if (!screens[name]) {
      check(`P ${name}: identik`, false, "layar tidak terekam");
      continue;
    }
    const d = diffScreen(name, base[name], screens[name]);
    check(`P ${name}: identik`, d === null, d ?? `${base[name].lines.length} baris, ${base[name].attrs.length} atribut`);
  }
  const allowedSeen = Object.entries(ALLOWED_ADDITIONS).every(([n, list]) => list.every((s) => screens[n]?.lines.includes(s) || screens[n]?.attrs.includes(s)));
  check("P+ tambahan yang disengaja memang tampil di Masuk & Profil", allowedSeen);
  console.log(failures === 0 ? `\nSemua ${checks} uji kesetaraan ID lulus.` : `\n${failures} uji GAGAL.`);
  process.exitCode = failures ? 1 : 0;
} else if (MODE === "english") {
  const shots = flag("shots", null);
  if (shots) mkdirSync(shots, { recursive: true });
  const base = JSON.parse(readFileSync(BASELINE, "utf8")).screens;
  const id320 = JSON.parse(readFileSync(path.join(SUPPORT, "i18n-id-320.json"), "utf8")).screens;
  const { screens } = await runFlow({ lang: "en", width: 320, shots });
  check("seluruh layar terekam dalam bahasa Inggris", Object.keys(screens).length === Object.keys(base).length, `${Object.keys(screens).length}/${Object.keys(base).length}`);
  for (const [name, s] of Object.entries(screens)) {
    const all = [...s.lines, ...s.attrs];
    const leftovers = all.filter((l) => ID_WORDS.test(l) && !SERVER_OK.some((re) => re.test(l)));
    check(`E ${name}: tanpa teks Indonesia buatan app`, leftovers.length === 0, leftovers.slice(0, 5).join(" | ") || `${all.length} string`);
    const raw = all.filter((l) => RAW_KEY.test(l));
    check(`E ${name}: tanpa kunci kamus mentah`, raw.length === 0, raw.slice(0, 3).join(" | "));
    // Pembanding: layar yang sama dalam bahasa Indonesia pada 320 px. Yang sudah ada
    // di ID (mis. modal top-up & penilaian di web) bukan akibat teks Inggris.
    const ref = id320[name];
    check(`E ${name}: 320 px, teks keluar tepi tidak lebih banyak dari ID`, s.overflow.length <= ref.overflow.length, `${s.overflow.length} vs ID ${ref.overflow.length}`);
    check(`E ${name}: 320 px, tombol keluar tepi tidak lebih banyak dari ID`, s.buttons.length <= ref.buttons.length, `${s.buttons.length} vs ID ${ref.buttons.length}`);
    const wrapped = (x) => x.fares.filter((f) => f.lines > 1).length;
    const outside = (x) => x.fares.filter((f) => f.right > 320).length;
    check(`E ${name}: tarif tidak turun baris dan tidak lebih jauh keluar dari ID`, wrapped(s) <= wrapped(ref) && outside(s) <= outside(ref), `${s.fares.length} tarif`);
    check(`E ${name}: teks terpotong tidak lebih banyak dari ID`, s.clipped.length <= ref.clipped.length, `${s.clipped.length} vs ID ${ref.clipped.length}`);
  }
  const airLines = ["beranda-tamu", "hasil-rute", "udara"].map((n) => screens[n].lines.join(" | "));
  check("E+ kategori udara berbahasa Inggris di kartu Beranda, Hasil Rute, dan layar detail", airLines.every((l) => /Air in Jakarta: Unhealthy/.test(l) && !/Tidak sehat/.test(l)));
  const fareCount = Object.values(screens).reduce((n, s) => n + s.fares.length, 0);
  check("E+ uji tarif tidak kosong", fareCount >= 20, `${fareCount} tarif`);
  console.log(failures === 0 ? `\nSemua ${checks} uji bahasa Inggris lulus.` : `\n${failures} uji GAGAL.`);
  process.exitCode = failures ? 1 : 0;
} else if (MODE === "pollutant") {
  const shots = flag("shots", null);
  if (shots) mkdirSync(shots, { recursive: true });
  await runFlow({ lang: "id", width: 320, shots: null, scenario: "pollutant" });
  await runFlow({ lang: "en", width: 320, shots, scenario: "pollutant" });
  console.log(failures === 0 ? `\nSemua ${checks} uji polutan lulus.` : `\n${failures} uji GAGAL.`);
  process.exitCode = failures ? 1 : 0;
} else if (MODE === "switch") {
  await runFlow({ lang: "id", width: 360, shots: flag("shots", null), scenario: "switch" });
  console.log(failures === 0 ? `\nSemua ${checks} uji pergantian bahasa lulus.` : `\n${failures} uji GAGAL.`);
  process.exitCode = failures ? 1 : 0;
} else {
  console.log(`Mode tidak dikenal: ${MODE}`);
  process.exitCode = 1;
}
void ROOT;
