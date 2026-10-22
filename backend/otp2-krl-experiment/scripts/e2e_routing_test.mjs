// Task 1.5 (H10-14 sprint): E2E routing test, 3 skenario.
//
// Menembak endpoint backend Express (POST /routes) — bukan OTP2 langsung —
// karena itulah yang benar-benar dipakai aplikasi, jadi ikut menguji
// kontrak skema, perhitungan tarif, reliability, dan recommendation score,
// bukan cuma "OTP2 menemukan rute".
//
// Jalankan: node e2e_routing_test.mjs [baseUrl]
const BASE = process.argv[2] ?? "http://localhost:3000";

// Jumat pagi jam sibuk — waktu dipatok supaya hasilnya bisa diulang
// (lihat departure_time di routing.ts / Task Backend-03c).
const DEPARTURE = "2026-09-21T07:30:00+07:00";

const POINTS = {
  blokM: { lat: -6.2444643, lng: 106.7981332, label: "Blok M" },
  kota: { lat: -6.1355, lng: 106.8165, label: "Kota" },
  bekasi: { lat: -6.23294, lng: 106.99396, label: "Stasiun Bekasi" },
  jakartaKota: { lat: -6.13487, lng: 106.82341, label: "Stasiun Jakarta Kota" },
};

const SCENARIOS = [
  {
    name: "Skenario 1: TransJakarta saja (baseline)",
    from: POINTS.blokM,
    to: POINTS.kota,
    expect: { modes: ["BUS"], note: "~30-40 menit, 1-2 transfer" },
  },
  {
    name: "Skenario 2: KRL saja (baru)",
    from: POINTS.bekasi,
    to: POINTS.jakartaKota,
    expect: { modes: ["RAIL"], note: "~40-50 menit, tanpa transfer" },
  },
  {
    name: "Skenario 3: Multimoda (KRL + TransJakarta)",
    from: POINTS.bekasi,
    to: POINTS.blokM,
    expect: { modes: ["RAIL", "BUS"], note: "pindah moda, tarif gabungan" },
  },
];

const fmtIdr = (n) => "Rp" + n.toLocaleString("id-ID");

async function run(scenario) {
  console.log(`\n=== ${scenario.name} ===`);
  console.log(`  ${scenario.from.label} -> ${scenario.to.label}  (harapan: ${scenario.expect.note})`);

  const started = Date.now();
  let res, body;
  try {
    res = await fetch(`${BASE}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lat: scenario.from.lat, lng: scenario.from.lng },
        destination: { lat: scenario.to.lat, lng: scenario.to.lng },
        departure_time: DEPARTURE,
      }),
    });
    body = await res.json();
  } catch (err) {
    console.log(`  GAGAL: request error — ${err.message}`);
    return { ok: false, reason: `request error: ${err.message}` };
  }
  const elapsed = Date.now() - started;

  if (!res.ok) {
    console.log(`  GAGAL: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  if (!Array.isArray(body.routes) || body.routes.length === 0) {
    console.log("  GAGAL: tidak ada rute yang ditemukan");
    return { ok: false, reason: "no routes" };
  }

  const modesSeen = new Set();
  for (const [i, r] of body.routes.entries()) {
    const modes = r.legs.map((l) => l.mode);
    modes.forEach((m) => modesSeen.add(m));
    const named = r.legs
      .filter((l) => l.mode !== "WALK")
      .map((l) => `${l.mode}:${l.route_name ?? "?"}`)
      .join(" > ") || "(jalan kaki saja)";
    console.log(
      `  [${i + 1}] ${named}\n` +
        `      waktu ${r.travel_time_minutes.min}-${r.travel_time_minutes.max} mnt | ` +
        `tarif ${fmtIdr(r.cost_idr)} | transfer ${r.transfer_count} | ` +
        `jalan ${r.walking_distance_m} m | risiko ${r.reliability?.risk ?? "-"} | ` +
        `skor ${r.recommendation_score.toFixed(3)}`,
    );
  }

  const checks = [];
  for (const m of scenario.expect.modes) {
    checks.push([`mode ${m} muncul`, modesSeen.has(m)]);
  }
  checks.push([
    "semua rute punya rentang waktu (bukan angka tunggal)",
    body.routes.every((r) => r.travel_time_minutes.max > r.travel_time_minutes.min),
  ]);
  checks.push([
    "indikator risiko transfer terisi",
    body.routes.every((r) => r.reliability && typeof r.reliability.risk === "string"),
  ]);
  checks.push([
    "rute bermoda transit punya tarif > 0",
    body.routes.every((r) =>
      r.legs.some((l) => l.mode !== "WALK") ? r.cost_idr > 0 : r.cost_idr === 0,
    ),
  ]);

  let ok = true;
  console.log(`      (respons ${elapsed} ms)`);
  for (const [label, passed] of checks) {
    console.log(`      ${passed ? "OK  " : "GAGAL"} ${label}`);
    if (!passed) ok = false;
  }
  return { ok, elapsed };
}

const results = [];
for (const s of SCENARIOS) results.push([s.name, await run(s)]);

console.log("\n" + "=".repeat(64));
let allOk = true;
for (const [name, r] of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${name}${r.reason ? ` — ${r.reason}` : ""}`);
  if (!r.ok) allOk = false;
}
console.log("=".repeat(64));
process.exit(allOk ? 0 : 1);
