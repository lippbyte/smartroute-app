// Hari 4 Task 1: pengembalian kuota TOTO saat provider PASTI tidak menagih.
//
//   node scripts/test-toto-refund.mjs
//
// Instance backend kedua (port 3107, DB sementara berskema LAMA — tabel
// toto_usage tanpa kolom refunded — untuk menguji migrasi) dengan
// OPENROUTER_URL ke provider tiruan yang perilakunya dipilih lewat penanda
// di pertanyaan. Instance ketiga (port 3108, DB sama) tanpa OPENROUTER_API_KEY.
// Membuktikan:
//   - dikembalikan: 401, 500, 502 HTML, koneksi ditolak, tanpa kunci;
//   - TIDAK dikembalikan: waktu habis, koneksi putus setelah terkirim,
//     200 bukan JSON, 429;
//   - batas per jam hanya menghitung yang tidak dikembalikan;
//   - batas global harian tetap menghitung SEMUA percobaan;
//   - balasan ke app tetap 502 generik tanpa detail provider.
// Butuh OTP2 hidup (backend memuat klaster halte saat start).
import { spawn, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.join(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(os.tmpdir(), "smartroute-toto-refund-"));
const DB_FILE = path.join(tmp, "uji.db");
const tag = randomBytes(4).toString("hex");

let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// --- DB berskema lama (sebelum Hari 4): toto_usage tanpa kolom refunded.
{
  const old = new DatabaseSync(DB_FILE);
  old.exec("PRAGMA foreign_keys = OFF;"); // tabel users dibuat backend nanti
  old.exec("CREATE TABLE toto_usage (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, asked_at INTEGER NOT NULL);");
  old.prepare("INSERT INTO toto_usage (user_id, asked_at) VALUES (?, ?)").run("pengguna-lama", Date.now());
  old.close();
}

// --- Provider tiruan.
let providerCalls = 0;
const sockets = new Set();
const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    providerCalls++;
    const last = JSON.parse(raw).messages.at(-1)?.content ?? "";
    const json = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (last.includes("UJI-401")) return json(401, { error: { code: 401, message: "User not found." } });
    if (last.includes("UJI-500")) return json(500, { error: { code: 500, message: "Internal Server Error" } });
    if (last.includes("UJI-502HTML")) {
      res.writeHead(502, { "Content-Type": "text/html" });
      return res.end("<html><body>502 Bad Gateway</body></html>");
    }
    if (last.includes("UJI-429")) return json(429, { error: { code: 429, message: "Rate limit exceeded" } });
    if (last.includes("UJI-BUKANJSON")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("bukan json");
    }
    if (last.includes("UJI-PUTUS")) return req.socket.destroy(); // terkirim, lalu putus
    if (last.includes("UJI-LAMBAT")) return setTimeout(() => !res.destroyed && json(200, { choices: [{ message: { content: "telat" } }] }), 17_000);
    return json(200, { choices: [{ message: { content: "Jawaban uji dari provider tiruan." } }] });
  });
});
stub.on("connection", (s) => {
  sockets.add(s);
  s.on("close", () => sockets.delete(s));
});
await new Promise((r) => stub.listen(0, "127.0.0.1", r));
const STUB_PORT = stub.address().port;
const STUB_URL = `http://127.0.0.1:${STUB_PORT}/api/v1/chat/completions`;

function startBackend(port, extraEnv) {
  const child = spawn(process.execPath, [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_PATH: DB_FILE, OPENROUTER_URL: STUB_URL, TOTO_HOURLY_LIMIT: "2", TOTO_DAILY_CAP: "100", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.log = "";
  child.stdout.on("data", (d) => (child.log += d));
  child.stderr.on("data", (d) => (child.log += d));
  return child;
}
// Kunci tiruan. Instance tanpa kunci: variabelnya dihapus (undefined tidak
// diteruskan spawn) DAN .env tidak dimuat (DOTENV_CONFIG_PATH ke berkas yang
// tidak ada) — kalau tidak, dotenv memuat kunci asli dari .env.
const NO_KEY_ENV = { OPENROUTER_API_KEY: undefined, DOTENV_CONFIG_PATH: path.join(tmp, "tidak-ada.env") };
const main = startBackend(3107, { OPENROUTER_API_KEY: "uji-bukan-key-asli" });
let nokey = { log: "" }; // dinyalakan setelah `main` selesai migrasi (lihat bawah)

async function waitReady(port, child) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch {}
    if (Date.now() > deadline) throw new Error(`backend :${port} tidak siap:\n${child.log.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function call(port, method, url, { token, body } = {}) {
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, ms: Date.now() - t0 };
}

async function register(name) {
  const r = await call(3107, "POST", "/auth/register", { body: { email: `${name}-${tag}@contoh.test`, password: randomBytes(12).toString("base64url"), name } });
  if (r.status !== 201) throw new Error(`register ${name} gagal: HTTP ${r.status}`);
  return r.json;
}

const ask = (token, q, port = 3107) => call(port, "POST", "/assistant/ask", { token, body: { question: `${q} Dari Blok M ke Kota naik apa?` } });
const GENERIC = "Layanan asisten sedang tidak tersedia. Coba lagi sebentar lagi.";
const isGeneric502 = (r) => r.status === 502 && r.json?.error === "assistant_unavailable" && r.json?.message === GENERIC && JSON.stringify(Object.keys(r.json).sort()) === '["error","message"]';

try {
  // Berurutan: dua instance yang memigrasi DB bersamaan bisa sama-sama
  // menjalankan ALTER TABLE.
  await waitReady(3107, main);
  nokey = startBackend(3108, NO_KEY_ENV);
  await waitReady(3108, nokey);
  const db = new DatabaseSync(DB_FILE);
  const cols = db.prepare("PRAGMA table_info(toto_usage)").all().map((c) => c.name);
  const oldRow = db.prepare("SELECT refunded FROM toto_usage WHERE user_id = 'pengguna-lama'").get();
  check("M1 DB lama dimigrasi: kolom refunded ditambahkan, baris lama tetap (refunded=0)", cols.includes("refunded") && oldRow?.refunded === 0, cols.join(","));

  const lastRow = (userId) => db.prepare("SELECT refunded FROM toto_usage WHERE user_id = ? ORDER BY rowid DESC LIMIT 1").get(userId);
  const rowsOf = (userId) => db.prepare("SELECT COUNT(*) c FROM toto_usage WHERE user_id = ?").get(userId).c;

  // --- 1. Dikembalikan (pengguna A, batas 2/jam).
  const a = await register("refund-a");
  for (const [label, marker, port] of [
    ["401 (kunci ditolak)", "UJI-401", 3107],
    ["500", "UJI-500", 3107],
    ["502 HTML (proxy)", "UJI-502HTML", 3107],
  ]) {
    const n = providerCalls;
    const r = await ask(a.token, marker, port);
    check(`R ${label} -> 502 generik, provider dipanggil, kuota dikembalikan`, isGeneric502(r) && providerCalls === n + 1 && lastRow(a.user.id)?.refunded === 1, `${r.status} refunded=${lastRow(a.user.id)?.refunded}`);
  }
  // Koneksi ditolak: tutup provider, port sama tidak menerima koneksi.
  stub.close();
  for (const s of sockets) s.destroy();
  {
    const r = await ask(a.token, "UJI-TOLAK");
    check("R koneksi ditolak (provider mati) -> 502 generik, kuota dikembalikan", isGeneric502(r) && lastRow(a.user.id)?.refunded === 1, `${r.status} refunded=${lastRow(a.user.id)?.refunded}`);
  }
  await new Promise((r, j) => stub.listen(STUB_PORT, "127.0.0.1", r).once("error", j));
  {
    const n = providerCalls;
    const r = await ask(a.token, "UJI-TANPAKUNCI", 3108);
    check("R tanpa OPENROUTER_API_KEY -> 502 generik, provider TIDAK dipanggil, kuota dikembalikan", isGeneric502(r) && providerCalls === n && lastRow(a.user.id)?.refunded === 1, `${r.status} refunded=${lastRow(a.user.id)?.refunded}`);
  }
  // 5 kegagalan dikembalikan -> A masih punya 2 kuota penuh.
  const a1 = await ask(a.token, "OK");
  const a2 = await ask(a.token, "OK");
  const n3 = providerCalls;
  const a3 = await ask(a.token, "OK");
  check("H1 setelah 5 kegagalan dikembalikan: 2 pertanyaan berhasil, ke-3 429 (batas 2/jam)", a1.status === 200 && a2.status === 200 && a3.status === 429 && a3.json?.error === "hourly_limit_reached" && providerCalls === n3, `${a1.status},${a2.status},${a3.status}`);
  check("H2 semua percobaan A tetap tercatat (5 dikembalikan + 2 berhasil)", rowsOf(a.user.id) === 7, `${rowsOf(a.user.id)} baris`);

  // --- 2. TIDAK dikembalikan.
  const b = await register("refund-b");
  {
    const r = await ask(b.token, "UJI-LAMBAT");
    check("N waktu habis -> 502 generik ~15 dtk, kuota TIDAK dikembalikan", isGeneric502(r) && r.ms >= 14_000 && r.ms < 20_000 && lastRow(b.user.id)?.refunded === 0, `${r.status} ${r.ms} ms refunded=${lastRow(b.user.id)?.refunded}`);
  }
  {
    const r = await ask(b.token, "UJI-PUTUS");
    check("N koneksi putus setelah terkirim -> 502 generik, kuota TIDAK dikembalikan", isGeneric502(r) && lastRow(b.user.id)?.refunded === 0, `${r.status} refunded=${lastRow(b.user.id)?.refunded}`);
  }
  {
    const n = providerCalls;
    const r = await ask(b.token, "OK");
    check("N B sudah 2 percobaan terhitung -> 429 tanpa panggilan provider", r.status === 429 && r.json?.error === "hourly_limit_reached" && providerCalls === n, `${r.status}`);
  }
  const c = await register("refund-c");
  for (const [label, marker] of [
    ["200 bukan JSON", "UJI-BUKANJSON"],
    ["429 dari provider", "UJI-429"],
  ]) {
    const r = await ask(c.token, marker);
    check(`N ${label} -> 502 generik, kuota TIDAK dikembalikan`, isGeneric502(r) && lastRow(c.user.id)?.refunded === 0, `${r.status} refunded=${lastRow(c.user.id)?.refunded}`);
  }
  {
    const r = await ask(c.token, "OK");
    check("N C sudah 2 percobaan terhitung -> 429", r.status === 429 && r.json?.error === "hourly_limit_reached", `${r.status}`);
  }

  // --- 3. Batas harian menghitung SEMUA percobaan, termasuk yang dikembalikan.
  const total = db.prepare("SELECT COUNT(*) c FROM toto_usage").get().c;
  const refundedCount = db.prepare("SELECT COUNT(*) c FROM toto_usage WHERE refunded = 1").get().c;
  writeFileSync(path.join(tmp, "toto-limits.json"), JSON.stringify({ daily_cap: total }));
  const d = await register("refund-d");
  {
    const n = providerCalls;
    const r = await ask(d.token, "OK");
    check(`D1 daily_cap = total percobaan (${total}, ${refundedCount} dikembalikan) -> pengguna baru 429 daily_cap_reached`, r.status === 429 && r.json?.error === "daily_cap_reached" && providerCalls === n && refundedCount === 5, `${r.status} ${r.json?.error}`);
  }
  writeFileSync(path.join(tmp, "toto-limits.json"), JSON.stringify({ daily_cap: total + 1 }));
  {
    const r = await ask(d.token, "OK");
    check("D2 daily_cap = total + 1 -> pengguna baru 200 (batas harian bukan karena hal lain)", r.status === 200, `${r.status}`);
  }

  // --- 4. Log server memuat jenis kegagalan; detail tidak ke app.
  const log = main.log + nokey.log;
  check("L1 log server menandai kegagalan yang dikembalikan", (log.match(/kuota dikembalikan/g) ?? []).length === 5, `${(log.match(/kuota dikembalikan/g) ?? []).length}x`);
  check("L2 log server mencatat jenis kegagalan", /\[http 401, kuota dikembalikan\]/.test(log) && /\[connect, kuota dikembalikan\]/.test(log) && /\[config, kuota dikembalikan\]/.test(log) && /\[timeout\]/.test(log) && /\[network\]/.test(log) && /\[http 429\]/.test(log) && /\[bad_response\]/.test(log));
  db.close();
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  for (const child of [main, nokey]) {
    if (!child.pid) continue;
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
      else child.kill("SIGTERM");
    } catch {}
  }
  stub.close();
  stub.closeAllConnections?.();
  await new Promise((r) => setTimeout(r, 1000));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

const MIN_CHECKS = 18;
check(`jumlah cek >= ${MIN_CHECKS}`, checks >= MIN_CHECKS, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji pengembalian kuota TOTO lulus.` : `\n${failures} uji GAGAL.`);
if (failures) console.log("\n--- log backend uji ---\n" + (main.log + nokey.log).slice(-3000));
process.exitCode = failures === 0 ? 0 : 1;
