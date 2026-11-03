// Hotfix TOTO: uji jawaban LLM SUNGGUHAN, tiap pertanyaan diulang N kali.
//
//   node scripts/test-toto-live.mjs [N=5] [out.json]
//   node scripts/test-toto-live.mjs reassess <out.json>   (nilai ulang, tanpa biaya)
//
// BERBAYAR: setiap jawaban = satu panggilan OpenRouter memakai kunci di .env.
// Instance backend kedua (port 3112, DB sementara, akun uji sekali-pakai), jadi
// kuota akun demo & database asli tidak tersentuh. Butuh OTP2 hidup. Kunci tidak
// dicetak.
//
// Penilaian otomatis hanya penyaring: jawaban lengkap disimpan ke out.json dan
// WAJIB dibaca manusia sebelum menyimpulkan "masih mengarang".
import { spawn, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const N = Number(process.argv[2] ?? 5);
const OUT = process.argv[3] ?? null;
const PORT = 3112;
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = mkdtempSync(path.join(os.tmpdir(), "smartroute-toto-live-"));

const GPS = { user_location: { lat: -6.2444643, lng: 106.7981332 } };
const Q5_CTX = { origin: { lat: -6.243312, lng: 106.80175 }, destination: { lat: -6.13679, lng: 106.8149 } };
// kind: safe = tarif/jam; route = pertanyaan rute tanpa data kandidat (harus
// diarahkan ke pencarian rute); grounded = ada kandidat rute; nearby = halte terdekat.
const CASES = [
  { id: "Q2", kind: "safe", q: "Berapa tarif TransJakarta?", must: [/3\.500/, /Royaltrans/i, /20\.000/, /35\.000/] },
  { id: "Q2+GPS", kind: "safe", q: "Berapa tarif TransJakarta?", context: GPS, must: [/3\.500/, /Royaltrans/i, /20\.000/, /35\.000/] },
  { id: "Q3", kind: "safe", q: "Jam berapa TransJakarta mulai dan berhenti beroperasi?", must: [/05[:.]00/, /22[:.]00/] },
  { id: "Q3+GPS", kind: "safe", q: "Jam berapa TransJakarta mulai dan berhenti beroperasi?", context: GPS, must: [/05[:.]00/, /22[:.]00/] },
  { id: "Q1", kind: "route", q: "Dari Blok M ke Kota naik apa?" },
  { id: "Q1+GPS", kind: "route", q: "Dari Blok M ke Kota naik apa?", context: GPS },
  { id: "Q4", kind: "route", q: "Dari Kalideres ke PGC naik koridor berapa?" },
  { id: "Q6", kind: "route", q: "Dari Fatmawati ke Manggarai naik apa?" },
  { id: "Monas+GPS", kind: "route", q: "Dari sini ke Monas naik apa?", context: GPS },
  { id: "Q5", kind: "route", q: "Berapa lama perjalanannya dan apakah ramai?" },
  { id: "Q5+rute", kind: "grounded", q: "Berapa lama perjalanannya dan apakah ramai?", context: Q5_CTX },
  { id: "Halte+GPS", kind: "nearby", q: "Halte terdekat dari saya di mana?", context: GPS },
];

// Penyaring. "durasi" tidak menghitung "3 jam" (jendela transfer gratis).
const DURATION = /\b\d+\s*(?:(?:-|–|—|sampai|hingga)\s*\d+\s*)?(?:menit|mnt)\b|\b\d+\s*(?:-|–)\s*\d+\s*jam\b/i;
const TRANSFER_CLAIM = /(transfer|pindah|ganti|lanjut(?:kan)?|sambung)[^.\n]{0,40}\b(ke|dengan|naik)\s+(?:\*\*)?(rute|koridor|bus|krl|mrt|lrt|tj|transjakarta|commuter|\d)/i;
const SUPERLATIVE = /tercepat|paling cepat|termurah|paling murah|paling efisien/i;
const NAMES_ROUTE = /\b(?:naik|gunakan|pakai|ambil)\s+(?:\*\*)?(?:(?:TransJakarta|Rute|Koridor|KRL|MRT|LRT|Bus|JakLingko)\b)|\*\*(?:Rute|Koridor)\s+[0-9A-Z]/i;
const REALTIME = /real[- ]?time/i;
const REALTIME_NEGATED = /(bukan|tidak|tanpa|belum|tak)[^.\n]{0,40}real[- ]?time/i;
const REDIRECT = /pencarian rute|cari rute/i;
const INVERTED = /(keandalan|andal)[^.\n]{0,40}\brendah\b/i;
// TOTO tidak melihat hasil pencarian rute dan tidak menghitung rute.
const FALSE_PROMISE = /nanti saya|saya akan kasih|saya bisa lihat|saya bantu cari rute/i;
// Kartu halte hanya tampil untuk pertanyaan halte terdekat (NEARBY_INTENT).
const CARD_BUTTON = /Berangkat dari sini|Jalan ke sini/;
const NO_SUCH_FEATURE = /tanya pengguna lain|komunitas/i;
// GTFS: 18 dari 18 rute Transjabodetabek Rp3.500. Tidak premium.
const TRANSJAB_PREMIUM = /(premium|lebih (?:tinggi|mahal))[^.\n]{0,60}Transjabodetabek|Transjabodetabek[^.\n]{0,60}(premium|lebih (?:tinggi|mahal)|20\.000|35\.000)/i;

function assess(c, answer, ctx) {
  const flags = [];
  const minutes = DURATION.exec(answer)?.[0];
  if (REALTIME.test(answer)) flags.push(REALTIME_NEGATED.test(answer) ? "real-time-disangkal" : "REAL-TIME");
  if (FALSE_PROMISE.test(answer)) flags.push(`JANJI-PALSU(${FALSE_PROMISE.exec(answer)[0]})`);
  if (c.kind === "safe") {
    if (minutes) flags.push(`DURASI(${minutes})`);
    for (const re of c.must ?? []) if (!re.test(answer)) flags.push(`KURANG(${re.source})`);
    if (TRANSJAB_PREMIUM.test(answer)) flags.push("TRANSJABODETABEK-PREMIUM");
  }
  if (c.kind === "route") {
    if (minutes) flags.push(`DURASI(${minutes})`);
    if (TRANSFER_CLAIM.test(answer)) flags.push(`TRANSFER(${TRANSFER_CLAIM.exec(answer)[0].slice(0, 40)})`);
    if (SUPERLATIVE.test(answer)) flags.push(`SUPERLATIF(${SUPERLATIVE.exec(answer)[0]})`);
    if (NAMES_ROUTE.test(answer)) flags.push(`SEBUT-RUTE(${NAMES_ROUTE.exec(answer)[0].slice(0, 30)})`);
    if (!REDIRECT.test(answer) && !/Cari Rute Terbaik/.test(answer)) flags.push("TANPA-ARAHAN");
    if (CARD_BUTTON.test(answer)) flags.push("TOMBOL-TIDAK-ADA");
  }
  if (c.kind === "grounded") {
    const found = [...answer.matchAll(/(\d+)\s*(?:-|–|—|sampai|hingga)\s*(\d+)\s*(?:menit|mnt)/gi)];
    const ranges = found.map((m) => `${m[1]}-${m[2]}`);
    const foreign = ranges.filter((r) => !ctx.ranges.has(r));
    if (foreign.length) flags.push(`ANGKA-ASING(${foreign.join(",")})`);
    if (ranges.length === 0) flags.push("TANPA-WAKTU");
    if (INVERTED.test(answer)) flags.push("KEANDALAN-TERBALIK");
    if (CARD_BUTTON.test(answer)) flags.push("TOMBOL-TIDAK-ADA");
    if (NO_SUCH_FEATURE.test(answer)) flags.push("FITUR-TIDAK-ADA");
    // "tercepat" harus menunjuk rute dengan batas bawah terkecil di data.
    const fastestAt = answer.search(/tercepat|paling cepat/i);
    if (fastestAt >= 0) {
      const next = found.find((m) => m.index > fastestAt);
      const smallest = Math.min(...[...ctx.ranges].map((r) => Number(r.split("-")[0])));
      if (next && Number(next[1]) !== smallest) flags.push(`TERCEPAT-KELIRU(${next[1]}-${next[2]})`);
    }
  }
  if (c.kind === "nearby") {
    if (!ctx.nearbyNames.some((n) => answer.includes(n))) flags.push("HALTE-ASING");
    if (minutes && !/jalan kaki/i.test(answer)) flags.push(`DURASI(${minutes})`);
  }
  return flags;
}

function summarize(c, rows) {
  const bad = rows.filter((x) => x.flags.some((f) => f !== "real-time-disangkal"));
  const ms = rows.map((x) => x.ms);
  console.log(`${c.id.padEnd(10)} ${c.kind.padEnd(8)} bersih ${rows.length - bad.length}/${rows.length}  ${Math.min(...ms)}-${Math.max(...ms)} ms${bad.length ? `  :: ${bad.map((x) => `#${x.i} ${x.flags.filter((f) => f !== "real-time-disangkal").join(" ")}`).join(" | ")}` : ""}`);
  return bad.length;
}

if (process.argv[2] === "reassess") {
  const saved = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const ctx = { ranges: new Set(saved.q5Ranges), nearbyNames: saved.nearby };
  let total = 0;
  let flagged = 0;
  for (const c of CASES) {
    const rows = saved.results.filter((r) => r.id === c.id).map((r) => ({ ...r, flags: r.status === 200 ? assess(c, r.answer, ctx) : [`HTTP-${r.status}`] }));
    if (rows.length === 0) continue;
    total += rows.length;
    flagged += summarize(c, rows);
  }
  console.log(`\n${total} jawaban, ${flagged} ditandai penyaring.`);
  process.exit(0);
}

const backend = spawn(process.execPath, [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(tmp, "uji.db"), TOTO_HOURLY_LIMIT: "5000", TOTO_DAILY_CAP: "5000" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
backend.stdout.on("data", (d) => (log += d));
backend.stderr.on("data", (d) => (log += d));

const post = async (url, body, token) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null), ms: Date.now() - t0 };
};

let failed = 0;
const results = [];
try {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`backend uji tidak siap:\n${log.slice(-1500)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  const reg = await post("/auth/register", { email: `live-${randomBytes(4).toString("hex")}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Demo SmartRoute" });
  const token = reg.json?.token;
  if (!token) throw new Error(`register gagal: HTTP ${reg.status}`);

  const q5Routes = (await post("/routes", Q5_CTX)).json.routes;
  const nearby = await (await fetch(`${BASE}/nearby-stops?lat=${GPS.user_location.lat}&lng=${GPS.user_location.lng}`)).json();
  const ctx = {
    ranges: new Set(q5Routes.map((r) => `${r.travel_time_minutes.min}-${r.travel_time_minutes.max}`)),
    nearbyNames: nearby.slice(0, 8).map((s) => s.name),
  };

  for (const c of CASES) {
    for (let i = 1; i <= N; i++) {
      const r = await post("/assistant/ask", { question: c.q, ...(c.context ? { context: c.context } : {}) }, token);
      const answer = r.json?.answer ?? "";
      const flags = r.status === 200 ? assess(c, answer, ctx) : [`HTTP-${r.status}`];
      results.push({ id: c.id, kind: c.kind, i, status: r.status, ms: r.ms, flags, answer });
    }
    failed += summarize(c, results.filter((x) => x.id === c.id));
  }
  if (OUT) writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), q5Ranges: [...ctx.ranges], nearby: ctx.nearbyNames, results }, null, 2));
} catch (err) {
  failed++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${backend.pid} /T /F`, { stdio: "ignore" });
    else backend.kill("SIGTERM");
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
}
console.log(`\n${results.length} jawaban, ${failed} ditandai penyaring (baca jawabannya sebelum menyimpulkan).`);
process.exitCode = failed ? 1 : 0;
