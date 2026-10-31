// Hari 4 Task 1: uji pemetaan galat terpusat (apiClient) dengan KODE ASLI
// service app — layar lama (rute, kepadatan, halte, cari stasiun) maupun
// baru (apiRequest langsung). Setiap galat yang sampai ke layar harus berupa
// pesan generik; detail teknis (URL, status HTTP) hanya boleh di console.
//
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs \
//        scripts/test-error-mapping.mts <skenario>
//
// Skenario:
//   mock                  server tiruan lokal: halaman galat ngrok (502 HTML
//                         ERR_NGROK_8012, 404 HTML ERR_NGROK_3200), HTML 200,
//                         JSON 500 tanpa pesan, server menggantung (waktu
//                         habis), dan pembatalan oleh pemanggil.
//   backend-dead          EXPO_PUBLIC_API_BASE_URL ke port mati.
//   otp-down              backend hidup dengan OTP2_URL mati (pesan rute 502).
//   tunnel-backend-dead   URL tunnel ngrok asli, backend di belakangnya mati.
//   tunnel-agent-dead     URL tunnel ngrok asli, agen ngrok mati.
// Untuk skenario selain "mock", EXPO_PUBLIC_API_BASE_URL wajib diisi.
import http from "node:http";
import type { AddressInfo } from "node:net";

const SCENARIO = process.argv[2] ?? "mock";
let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  [${SCENARIO}] ${name}${detail ? `  (${detail})` : ""}`);
}

// Detail teknis yang tidak boleh sampai ke layar.
const LEAK = /https?:|localhost|127\.0\.0\.1|ngrok|otp|<|>|\bHTTP\b|\b[1-5]\d\d\b|json|backend|ECONN|fetch|undefined|null/i;

// Tangkap console.warn: detail harus ADA di sana (bukti tidak hilang).
const warns: string[] = [];
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  warns.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(" "));
};

// --- server tiruan (skenario mock) ---
type MockMode = "ngrok-502" | "ngrok-404" | "html-200" | "json-500-bare" | "hang";
let mode: MockMode = "ngrok-502";
let server: http.Server | null = null;
const hanging: http.ServerResponse[] = [];
if (SCENARIO === "mock") {
  server = http.createServer((req, res) => {
    req.resume();
    switch (mode) {
      case "ngrok-502":
        res.writeHead(502, { "Content-Type": "text/html", "ngrok-error-code": "ERR_NGROK_8012" });
        res.end('<!DOCTYPE html><html><body>Traffic was successfully tunneled to the ngrok agent, but the agent failed to establish a connection to the upstream web service at http://localhost:3000. ERR_NGROK_8012</body></html>');
        return;
      case "ngrok-404":
        res.writeHead(404, { "Content-Type": "text/html", "ngrok-error-code": "ERR_NGROK_3200" });
        res.end("<!DOCTYPE html><html><body>The endpoint crazed-gatherer-simply.ngrok-free.dev is offline. ERR_NGROK_3200</body></html>");
        return;
      case "html-200":
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body>You are about to visit ngrok-free.dev</body></html>");
        return;
      case "json-500-bare":
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal" }));
        return;
      case "hang":
        hanging.push(res); // tidak pernah dibalas
        return;
    }
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  process.env.EXPO_PUBLIC_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
} else if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  console.error("EXPO_PUBLIC_API_BASE_URL wajib diisi untuk skenario ini");
  process.exit(2);
}

// Diimpor SETELAH env diisi: API_BASE_URL dibaca sekali saat modul dimuat.
const { apiRequest, ApiError, NETWORK_ERROR_MESSAGE, UNAVAILABLE_MESSAGE } = await import("../src/services/apiClient");
const { fetchRealRoutes, RouteFetchError } = await import("../src/services/routeService");
const crowd = await import("../src/services/crowdService");
const nearby = await import("../src/services/nearbyStopsService");
const { searchStationSuggestions } = await import("../src/services/stationSearchService");

// Pesan rute generik dari backend (backend/.../lib/respond.ts).
const ROUTING_MESSAGE = "Layanan rute sedang tidak tersedia. Coba lagi sebentar lagi.";

const MONAS = { lat: -6.1754, lng: 106.8272 };
const BLOK_M = { lat: -6.2441, lng: 106.7987 };

// Semua pemanggil backend yang dipakai layar. `cls` = kelas galat yang
// diharapkan dari service (kelas lama dipertahankan).
const CALLERS: { name: string; cls: Function; call: () => Promise<unknown> }[] = [
  { name: "rute (POST /routes)", cls: RouteFetchError, call: () => fetchRealRoutes(MONAS, BLOK_M, "2026-09-21T07:30:00+07:00") },
  { name: "peta kepadatan (GET /crowd-reports)", cls: crowd.CrowdOverviewFetchError, call: () => crowd.fetchCrowdOverview() },
  { name: "cari halte lapor (GET /stops/search)", cls: crowd.StopSearchError, call: () => crowd.searchStops("Monas") },
  { name: "kirim laporan (POST /crowd-reports)", cls: crowd.CrowdReportSubmitError, call: () => crowd.submitCrowdReport("uji:tidak-ada", "low") },
  { name: "halte terdekat (GET /nearby-stops)", cls: nearby.NearbyStopsFetchError, call: () => nearby.fetchNearbyStops(MONAS.lat, MONAS.lng) },
  { name: "semua halte (GET /all-stops)", cls: nearby.NearbyStopsFetchError, call: () => nearby.fetchAllStops() }, // 4 moda: TransJakarta lewat OTP2
  { name: "cari stasiun (GET /stations/search)", cls: ApiError, call: () => searchStationSuggestions("Monas") },
  { name: "layar baru (GET /health via apiRequest)", cls: ApiError, call: () => apiRequest("GET", "/health", { timeoutMessage: "Memuat terlalu lama." }) },
];

async function settle(fn: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; err: unknown }> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return { ok: false, err };
  }
}

/** Semua pemanggil harus gagal dengan pesan `expected` persis, tanpa detail. */
async function expectAll(label: string, expected: string, opts: { warnMatch?: RegExp } = {}) {
  for (const c of CALLERS) {
    const warnBefore = warns.length;
    const r = await settle(c.call);
    if (r.ok) {
      check(`${label}: ${c.name} gagal`, false, "malah berhasil");
      continue;
    }
    const msg = r.err instanceof Error ? r.err.message : String(r.err);
    check(`${label}: ${c.name} -> pesan generik`, msg === expected && !LEAK.test(msg) && r.err instanceof c.cls, `"${msg}" (${(r.err as Error)?.name})`);
    if (opts.warnMatch) {
      const logged = warns.slice(warnBefore).join(" | ");
      check(`${label}: ${c.name} -> detail hanya di console`, opts.warnMatch.test(logged), logged.slice(0, 120));
    }
  }
}

if (SCENARIO === "mock") {
  mode = "ngrok-502";
  await expectAll("tunnel 502 HTML (backend mati)", NETWORK_ERROR_MESSAGE, { warnMatch: /bukan JSON \(HTTP 502\)/ });
  mode = "ngrok-404";
  await expectAll("tunnel 404 HTML (agen mati)", NETWORK_ERROR_MESSAGE, { warnMatch: /bukan JSON \(HTTP 404\)/ });
  mode = "html-200";
  await expectAll("HTML 200 (halaman peringatan)", NETWORK_ERROR_MESSAGE, { warnMatch: /bukan JSON \(HTTP 200\)/ });
  mode = "json-500-bare";
  await expectAll("JSON 500 tanpa pesan", UNAVAILABLE_MESSAGE, { warnMatch: /HTTP 500 internal/ });

  // Waktu habis: pesan operasi dari pemanggil, bukan detail teknis.
  mode = "hang";
  const t0 = Date.now();
  const r = await settle(() => apiRequest("GET", "/health", { timeoutMs: 300, timeoutMessage: "Memuat terlalu lama. Coba lagi." }));
  const err = r.ok ? null : (r.err as InstanceType<typeof ApiError>);
  check("waktu habis -> ApiError timeout, pesan pemanggil", err instanceof ApiError && err.code === "timeout" && err.message === "Memuat terlalu lama. Coba lagi." && err.isNetwork, err ? `${err.code}: ${err.message}` : "berhasil?");
  check("waktu habis -> dihentikan tepat waktu (bukan menggantung)", Date.now() - t0 < 3000, `${Date.now() - t0} ms`);

  // Pembatalan oleh pemanggil (pengguna lanjut mengetik): BUKAN galat yang
  // dipetakan ke pesan — diteruskan apa adanya supaya layar mengabaikannya.
  for (const [name, fn] of [
    ["cari halte lapor", (s: AbortSignal) => crowd.searchStops("Mon", s)],
    ["cari stasiun", (s: AbortSignal) => searchStationSuggestions("Mon", s)],
  ] as const) {
    const ac = new AbortController();
    const p = settle(() => fn(ac.signal));
    setTimeout(() => ac.abort(), 50);
    const a = await p;
    const e = a.ok ? null : a.err;
    check(`pembatalan ${name} -> diteruskan, tidak dipetakan`, !!e && !(e instanceof ApiError) && !(e instanceof crowd.StopSearchError), e ? `${(e as Error).name}` : "berhasil?");
  }
  for (const res of hanging) res.destroy();
  server!.close();
} else if (SCENARIO === "backend-dead") {
  await expectAll("backend mati", NETWORK_ERROR_MESSAGE, { warnMatch: /tidak terjangkau/ });
} else if (SCENARIO === "tunnel-backend-dead" || SCENARIO === "tunnel-agent-dead") {
  // Status asli dari tepi ngrok bisa 502/503/404 — yang diuji: pesan layar
  // sama, detail status hanya di console.
  await expectAll(SCENARIO === "tunnel-backend-dead" ? "tunnel, backend mati" : "tunnel, agen ngrok mati", NETWORK_ERROR_MESSAGE, { warnMatch: /bukan JSON \(HTTP \d{3}\)|tidak terjangkau/ });
} else if (SCENARIO === "otp-down") {
  // Endpoint yang butuh OTP2 -> pesan rute generik dari backend; sisanya
  // boleh berhasil (mis. GET /health, kirim laporan), tapi kalau gagal pun
  // pesannya harus generik.
  // Laporan aktif (di instance uji ini saja) supaya GET /crowd-reports
  // benar-benar menyentuh OTP2 — daftar kosong tidak butuh OTP2.
  await crowd.submitCrowdReport("1:G00753", "high");
  const NEEDS_OTP = new Set(["rute (POST /routes)", "peta kepadatan (GET /crowd-reports)", "cari halte lapor (GET /stops/search)", "halte terdekat (GET /nearby-stops)", "semua halte (GET /all-stops)", "cari stasiun (GET /stations/search)"]);
  for (const c of CALLERS) {
    const r = await settle(c.call);
    if (NEEDS_OTP.has(c.name)) {
      const msg = r.ok ? "(berhasil)" : (r.err as Error).message;
      check(`OTP2 mati: ${c.name} -> pesan rute generik`, !r.ok && msg === ROUTING_MESSAGE && !LEAK.test(msg) && r.err instanceof c.cls, msg);
    } else {
      const msg = r.ok ? "" : (r.err as Error).message;
      check(`OTP2 mati: ${c.name} -> berhasil atau generik`, r.ok || !LEAK.test(msg), r.ok ? "berhasil" : msg);
    }
  }
} else {
  console.error(`skenario tidak dikenal: ${SCENARIO}`);
  process.exit(2);
}

console.warn = origWarn;
// Uji tidak boleh lulus kosong: setiap skenario punya jumlah cek minimum.
const MIN = { mock: 68,"backend-dead": 16, "tunnel-backend-dead": 16, "tunnel-agent-dead": 16, "otp-down": 8 }[SCENARIO] ?? 1;
check(`jumlah cek >= ${MIN}`, checks >= MIN, `${checks}`);
console.log(`\n${checks - failures}/${checks} lulus`);
// exitCode, bukan process.exit(): keluar paksa saat soket keep-alive fetch
// sedang ditutup memicu assertion libuv di Windows dan menimpa kode keluar.
process.exitCode = failures ? 1 : 0;
