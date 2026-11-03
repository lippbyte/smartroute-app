// Hotfix TOTO: uji layar TOTO di browser sungguhan, TANPA memanggil LLM.
//
//   node scripts/test-toto-screen.mjs [webUrl] [screenshotDir]
//
// Butuh: web Metro (bawaan http://localhost:8097, EXPO_PUBLIC_API_BASE_URL ke
// backend :3000), backend hidup, Chrome/Edge, dan akun demo
// (backend/backend-skeleton/data/demo-account.local.json). Masuk akun demo lalu
// keluar lagi di akhir (tanpa sisa sesi). POST /assistant/ask dicegat lewat CDP:
// jawaban tiruan, sehingga tanpa biaya, dan body permintaan bisa diperiksa.
// Kredensial & token tidak dicetak.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const WEB = (process.argv[2] || "http://localhost:8097").replace(/\/$/, "");
const SHOTS = process.argv[3] || null;
const API = "http://localhost:3000";
const PORT = 9337;
const ROOT = path.join(import.meta.dirname, "..");
const cred = JSON.parse(readFileSync(path.join(ROOT, "..", "backend", "backend-skeleton", "data", "demo-account.local.json"), "utf8"));
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const EXPECTED_CHIPS = ["Berapa tarif TransJakarta?", "Jam berapa TransJakarta mulai dan berhenti beroperasi?"];
const HONEST = "TOTO paling akurat untuk tarif dan jam operasional; untuk rute gunakan pencarian rute.";
const CHAT_NOTE = "Jawaban TOTO bisa keliru. Untuk rute, waktu tempuh, dan transfer, gunakan pencarian rute.";

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

let token = null;
let cdp;
const captured = [];
try {
  const login = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: cred.email, password: cred.password }) });
  const session = await login.json();
  token = session.token;
  if (!token) throw new Error(`login akun demo gagal: HTTP ${login.status}`);

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
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method)(msg.params);
    }
  };
  cdp = {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    close: () => ws.close(),
  };
  const ev = async (expression) => (await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const waitFor = async (expression, ms = 30_000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (await ev(expression)) return true;
      await sleep(250);
    }
    return false;
  };
  const tap = async (x, y) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await sleep(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const textRect = (text) => ev(`(() => { const el = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent === ${JSON.stringify(text)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const shot = async (name) => {
    if (!SHOTS) return;
    const s = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(SHOTS, name), Buffer.from(s.data, "base64"));
  };

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*/assistant/ask" }, { urlPattern: "*nominatim.openstreetmap.org/*" }] });
  listeners.set("Fetch.requestPaused", ({ requestId, request }) => {
    const headers = [
      { name: "Access-Control-Allow-Origin", value: "*" },
      { name: "Access-Control-Allow-Headers", value: "*" },
      { name: "Content-Type", value: "application/json" },
    ];
    if (request.method === "OPTIONS") return cdp.send("Fetch.fulfillRequest", { requestId, responseCode: 204, responseHeaders: headers });
    if (request.url.includes("nominatim")) {
      captured.push({ geocode: request.url });
      return cdp.send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from("[]").toString("base64") });
    }
    captured.push(JSON.parse(request.postData ?? "{}"));
    return cdp.send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ answer: "Jawaban tiruan untuk uji layar.", nearby_stops: [] })).toString("base64") });
  });

  await cdp.send("Page.navigate", { url: WEB });
  await waitFor("document.readyState === 'complete'", 60_000);
  await ev(`localStorage.setItem("smartroute.session.v1", ${JSON.stringify(JSON.stringify({ token, expires_at: session.expires_at, user: session.user }))}), true`);

  // --- Beranda: kartu TOTO tidak lagi mengajak bertanya rute.
  await cdp.send("Page.navigate", { url: WEB });
  await waitFor(`/TOTO · Asisten AI/.test(document.body.innerText) && !/Navigate Smarter/.test(document.body.innerText)`, 60_000);
  const home = await ev("document.body.innerText");
  const homeCard = /TOTO · Asisten AI\s*\n?([^\n]*)/.exec(home)?.[1] ?? "";
  check("T1 Beranda: kartu TOTO menulis teks jujur, tanpa klaim 'data transit asli'", /tarif/.test(homeCard) && /pencarian rute/.test(homeCard) && !/data transit asli/.test(home), homeCard);

  // --- Layar TOTO: tombol saran.
  await cdp.send("Page.navigate", { url: `${WEB}/assistant` });
  await waitFor(`/Contoh pertanyaan/.test(document.body.innerText) && !/Navigate Smarter/.test(document.body.innerText)`, 60_000);
  await sleep(500);
  const text = await ev("document.body.innerText");
  await shot("toto-kosong.png");
  const after = text.split("Contoh pertanyaan:")[1] ?? "";
  const chips = after.split("\n").map((s) => s.trim()).filter((s) => /\?$/.test(s));
  check("T2 tepat dua tombol saran: tarif & jam operasional", JSON.stringify(chips) === JSON.stringify(EXPECTED_CHIPS), JSON.stringify(chips));
  check("T3 tombol saran rute sudah hilang", !/Dari Blok M ke Kota|Dari sini ke Monas|Halte terdekat dari saya/.test(text));
  check("T4 teks pembuka jujur, tanpa 'bukan mengarang' atau ajakan rute", text.includes(HONEST) && !/mengarang|Mau ke mana|data transit asli/.test(text));
  check("T5 teks lokasi tidak mengajak bertanya rute", !/tanya halte terdekat & rute/.test(text));
  check("T5a catatan 'bisa keliru' tampil sebelum ada percakapan", text.includes(CHAT_NOTE));

  // --- Ketuk tombol saran: permintaan terkirim, tanpa tombol buka rute.
  const chip = await textRect(EXPECTED_CHIPS[0]);
  await tap(chip.x, chip.y);
  await waitFor(`/Jawaban tiruan untuk uji layar/.test(document.body.innerText)`, 15_000);
  check("T6 ketuk saran mengirim pertanyaan itu", captured.at(-1)?.question === EXPECTED_CHIPS[0], captured.at(-1)?.question);
  check("T7 tanpa tombol 'Lihat Hasil Rute' di bawah jawaban", !/Lihat Hasil Rute/.test(await ev("document.body.innerText")));

  // --- Ketik pertanyaan rute: app TIDAK lagi mengirim koordinat hasil geocode.
  const input = await ev(`(() => { const r = document.querySelector('textarea[placeholder="Tanya TOTO..."]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tap(input.x, input.y);
  await sleep(250);
  await cdp.send("Input.insertText", { text: "Dari Blok M ke Kota naik apa?" });
  await sleep(250);
  const send = await ev(`(() => { const r = document.querySelector('[aria-label="Kirim pertanyaan"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tap(send.x, send.y);
  const sent = await waitFor(`(document.body.innerText.match(/Jawaban tiruan untuk uji layar/g) || []).length >= 2`, 15_000);
  const body = captured.filter((c) => c.question).at(-1);
  await shot("toto-pertanyaan-rute.png");
  check("T8 pertanyaan rute terkirim", sent && body?.question === "Dari Blok M ke Kota naik apa?", body?.question);
  check("T9 tanpa koordinat asal/tujuan di konteks", !!body && !body.context?.origin && !body.context?.destination, JSON.stringify(body?.context ?? null));
  check("T10 layar TOTO tidak lagi memanggil geocode", captured.filter((c) => c.geocode).length === 0, `${captured.filter((c) => c.geocode).length} panggilan`);
  check("T11 tetap tanpa tombol 'Lihat Hasil Rute'", !/Lihat Hasil Rute/.test(await ev("document.body.innerText")));
  check("T12 riwayat percakapan tetap terkirim", Array.isArray(body?.history) && body.history.length === 2, `${body?.history?.length ?? 0} pesan`);
  // Catatan harus tetap terlihat setelah ada jawaban (pembuka sudah hilang),
  // termasuk di layar 320 px, dan tidak menutupi kotak ketik.
  const NOTE_BOX = `(() => { const el = [...document.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent === ${JSON.stringify(CHAT_NOTE)}); if (!el) return null; const r = el.getBoundingClientRect(); const i = document.querySelector('textarea[placeholder="Tanya TOTO..."]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, right: r.right, vw: innerWidth, vh: innerHeight, inputTop: i.top, scrollW: document.documentElement.scrollWidth }; })()`;
  const noteAfter = await ev(NOTE_BOX);
  check("T12a catatan tetap terlihat setelah ada jawaban, di atas kotak ketik", !!noteAfter && noteAfter.top >= 0 && noteAfter.bottom <= noteAfter.inputTop && !(await ev("document.body.innerText")).includes(HONEST), noteAfter ? `bawah ${Math.round(noteAfter.bottom)} / kotak ketik ${Math.round(noteAfter.inputTop)}` : "tidak ada");
  // Muat ulang pada lebar itu: mengubah ukuran setelah dimuat membuat viewport
  // emulasi melebar (402 px), sehingga pemeriksaan batas layar jadi longgar.
  for (const width of [320, 360]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 640, deviceScaleFactor: 2, mobile: true });
    await cdp.send("Page.navigate", { url: `${WEB}/assistant` });
    await waitFor(`/Contoh pertanyaan/.test(document.body.innerText) && !/Navigate Smarter/.test(document.body.innerText)`, 60_000);
    await sleep(500);
    const narrow = await ev(NOTE_BOX);
    const chipBox = await ev(`[...document.querySelectorAll("div")].filter((d) => d.children.length === 0 && ${JSON.stringify(EXPECTED_CHIPS)}.includes(d.textContent)).map((d) => { const pill = d.closest('[tabindex="0"]') ?? d; return Math.round(pill.getBoundingClientRect().right); })`);
    await shot(`toto-${width}.png`);
    // scrollWidth tidak dipakai: di web, gambar latar ScreenBackground selebar
    // 402 px melebarkan layar ini di bawah 402 px (sudah ada sebelum hotfix, web
    // saja, dicatat di laporan). Yang diuji: catatan tetap di dalam lebar layar.
    check(`T12b layar ${width} px: catatan utuh di dalam lebar layar, di atas kotak ketik`, !!narrow && narrow.right <= width && narrow.bottom <= narrow.inputTop, narrow ? `kanan ${Math.round(narrow.right)}/${width}` : "tidak ada");
    check(`T12c layar ${width} px: kedua tombol saran di dalam layar`, chipBox.length === 2 && chipBox.every((r) => r <= width - 8), `tepi kanan ${chipBox.join(", ")}`);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 820, deviceScaleFactor: 2, mobile: true });

  // --- Layar Tentang.
  await cdp.send("Page.navigate", { url: `${WEB}/about` });
  await waitFor(`/Transparansi data/.test(document.body.innerText) && !/Navigate Smarter/.test(document.body.innerText)`, 60_000);
  const about = await ev("document.body.innerText");
  check("T13 Tentang: teks jujur tampil, 'bukan dikarang' hilang", about.includes(HONEST) && !/dikarang/.test(about));
  check("T14 Tentang: bagian Kemitraan tidak berubah (tetap tersembunyi, menunggu Khalifa)", !/Kemitraan/.test(about));
  await shot("tentang.png");
  cdp.close();
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  if (token) {
    await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
    else browser.kill("SIGTERM");
  } catch {}
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}

// Sumber: tidak ada jalur tersisa ke tombol buka rute / penguraian rute.
const src = readFileSync(path.join(ROOT, "src", "app", "assistant.tsx"), "utf8");
check("T15 sumber: penguraian rute & geocode sudah dihapus dari layar TOTO", !/extractRouteQuery|resolveRouteQuery|geocodePlace|openRoute/.test(src));

const MIN = 21;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji layar TOTO lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
