// Hotfix TOTO: uji isi prompt yang benar-benar terkirim ke LLM, tanpa biaya.
//
//   node scripts/test-toto-grounding.mjs
//
// Instance backend kedua (port 3111, DB sementara) dengan OPENROUTER_URL ke
// provider tiruan yang mencatat setiap permintaan. Label risiko dicocokkan dengan
// GET /routes pada instance yang sama. Butuh OTP2 hidup. Database asli tidak disentuh.
import { spawn, execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = mkdtempSync(path.join(os.tmpdir(), "smartroute-toto-grounding-"));
const S1 = { origin: { lat: -6.243312, lng: 106.80175 }, destination: { lat: -6.13679, lng: 106.8149 } };
const EXPECTED_LABEL = { low: "rendah", medium: "sedang", high: "tinggi" };

let failures = 0;
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const captured = [];
const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    captured.push(JSON.parse(raw));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "Jawaban uji dari provider tiruan." } }] }));
  });
});
await new Promise((r) => stub.listen(0, "127.0.0.1", r));

const backend = spawn(process.execPath, [path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"), "src/index.ts"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(tmp, "uji.db"), OPENROUTER_URL: `http://127.0.0.1:${stub.address().port}/v1`, OPENROUTER_API_KEY: "uji-bukan-key-asli" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
backend.stdout.on("data", (d) => (log += d));
backend.stderr.on("data", (d) => (log += d));

const post = async (url, body, token) => {
  const r = await fetch(`${BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const systemOf = (req) => req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");

try {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error(`backend uji tidak siap:\n${log.slice(-1500)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  const reg = await post("/auth/register", { email: `grounding-${randomBytes(4).toString("hex")}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji" });
  const token = reg.json?.token;
  if (!token) throw new Error(`register gagal: HTTP ${reg.status}`);

  // --- Label risiko: konteks rute vs GET /routes.
  const routes = (await post("/routes", S1)).json.routes;
  const ask = await post("/assistant/ask", { question: "Berapa lama perjalanannya dan apakah ramai?", context: S1 }, token);
  const sys = systemOf(captured.at(-1));
  check("R1 pertanyaan dengan konteks rute sampai ke provider", ask.status === 200 && /Hasil pencarian rute konkret/.test(sys));
  check("R2 label lama 'keandalan sambungan' sudah hilang", !/keandalan sambungan/i.test(sys));
  check("R3 nilai mentah low/medium/high tidak terkirim sebagai label", !/risiko sambungan: (low|medium|high)/.test(sys));
  const risks = new Set(routes.map((r) => r.reliability?.risk));
  check("R4 data uji mencakup lebih dari satu tingkat risiko (uji tidak kosong)", risks.size >= 2, [...risks].join(","));
  for (const r of routes) {
    const line = sys.split("\n").find((l) => l.startsWith(`- Rute "${r.route_id}"`)) ?? "";
    const want = EXPECTED_LABEL[r.reliability.risk];
    check(`R5 rute ${r.route_id}: reliabilitas ${r.reliability.score} (risk ${r.reliability.risk}) -> "risiko sambungan: ${want}"`, line.endsWith(`risiko sambungan: ${want}`), line.slice(-40));
    check(`R6 rute ${r.route_id}: waktu tempuh di prompt sama dengan /routes`, line.includes(`estimasi ${r.travel_time_minutes.min}-${r.travel_time_minutes.max} menit`));
  }
  check("R7 skor tinggi = risiko rendah (arah tidak terbalik)", routes.filter((r) => r.reliability.score >= 0.9).every((r) => r.reliability.risk === "low") && routes.some((r) => r.reliability.score >= 0.9));

  // --- Aturan soal rute ada di instruksi sistem, dengan dan tanpa konteks rute.
  await post("/assistant/ask", { question: "Dari Blok M ke Kota naik apa?" }, token);
  const noCtx = systemOf(captured.at(-1));
  check("A1 tanpa konteks: tidak ada kandidat rute di prompt", !/- Rute "/.test(noCtx) && /ATURAN KETAT SOAL RUTE/.test(noCtx));
  for (const [name, re] of [
    ["larangan waktu tempuh", /JANGAN menyebut perkiraan waktu tempuh/],
    ["larangan transfer", /JANGAN menyarankan atau merangkai transfer/],
    ["larangan 'real-time'", /JANGAN memakai kata "real-time"/],
    ["arahan ke pencarian rute", /tekan "Cari Rute Terbaik"/],
  ]) {
    check(`A2 instruksi sistem memuat ${name}`, re.test(noCtx) && re.test(sys));
  }
  check("A3 tombol 'Cari Rute Terbaik' yang disebut memang ada di Beranda", /Cari Rute Terbaik/.test(readFileSync(path.join(ROOT, "..", "..", "smartroute", "src", "app", "(tabs)", "index.tsx"), "utf8")));
} catch (err) {
  failures++;
  console.log("GAGAL  uji terhenti:", err instanceof Error ? err.message : err);
} finally {
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${backend.pid} /T /F`, { stdio: "ignore" });
    else backend.kill("SIGTERM");
  } catch {}
  stub.close();
  stub.closeAllConnections?.();
  await new Promise((r) => setTimeout(r, 1000));
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {}
}

const MIN = 18;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(failures === 0 ? `\nSemua ${checks} uji prompt TOTO lulus.` : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
