// Regresi rute terkunci-jam: jalankan skenario demo ke satu instance backend
// dan simpan hasilnya sebagai JSON, supaya dua instance (mis. kode HEAD vs
// kode baru, atau graph lama vs graph baru) bisa dibandingkan persis.
//
//   node scripts/regression-routes.mjs <baseUrl> <out.json> [scenarioIds...]
//
// Urutan skenario disengaja: S1/S3 dulu, Pasar Baru terakhir — laporan
// kepadatan Monas bertahan 15 menit dan ikut menggeser S1 (Koridor 1
// melintasi peron Monas G00753), lihat catatan skenario demo.
import { writeFileSync } from "node:fs";

const [, , BASE = "http://localhost:3000", OUT = "regression.json", ...only] = process.argv;
const AT = "2026-09-21T07:30:00+07:00";

const P = {
  blokM: [-6.2444643, 106.7981332],
  kota: [-6.1355, 106.8165],
  grogol: [-6.167, 106.79],
  kampungMelayu: [-6.2244, 106.8664],
  // Titik pasar Pasar Baru — dari sinilah 2+1+M jadi #1 (terverifikasi 21
  // Sep); dari halte BRT H00141P rute itu tidak muncul sama sekali.
  pasarBaru: [-6.1622, 106.8347],
  lebakBulus: [-6.2892744, 106.7749355], // stasiun MRT
  // Stasiun LRT Jabodebek: rata-rata node stop_position OSM (2026-09-03),
  // daftar stasiunnya dicocokkan 18/18 dengan lrtjabodebek.kai.id.
  lrtJatiMulya: [-6.2641069, 107.0216679],
  lrtDukuhAtas: [-6.204828, 106.8255301],
  lrtHarjamukti: [-6.3738927, 106.8956692],
  lrtKuningan: [-6.2287849, 106.8332025],
};

export const SCENARIOS = [
  // LRT dulu: skenario PB+Monas meninggalkan laporan kepadatan 15 menit.
  { id: "L1", name: "LRT Jati Mulya -> Dukuh Atas BNI", from: P.lrtJatiMulya, to: P.lrtDukuhAtas, expectMode: "TRAM" },
  { id: "L2", name: "LRT Harjamukti -> Kuningan", from: P.lrtHarjamukti, to: P.lrtKuningan, expectMode: "TRAM" },
  { id: "S1", name: "Blok M -> Kota", from: P.blokM, to: P.kota },
  { id: "S3", name: "Grogol -> Kampung Melayu", from: P.grogol, to: P.kampungMelayu },
  { id: "PB", name: "Pasar Baru -> Lebak Bulus", from: P.pasarBaru, to: P.lebakBulus },
  {
    id: "PB+Monas",
    name: "Pasar Baru -> Lebak Bulus, setelah lapor Monas padat",
    from: P.pasarBaru,
    to: P.lebakBulus,
    before: async () => {
      const r = await fetch(`${BASE}/crowd-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop_id: "1:G00753", level: "high" }),
      });
      if (!r.ok) throw new Error(`lapor Monas gagal: HTTP ${r.status}`);
    },
  },
];

function summarize(route) {
  return {
    route_id: route.route_id,
    legs: route.legs
      .filter((l) => l.mode !== "WALK")
      .map((l) => `${l.mode}:${l.route_name ?? "?"}${l.route_category ? `[${l.route_category}]` : ""}`),
    minutes: [route.travel_time_minutes.min, route.travel_time_minutes.max],
    cost_idr: route.cost_idr,
    transfers: route.transfer_count,
    risk: route.reliability?.risk,
    crowd: route.crowd_level ?? null,
    score: Number(route.recommendation_score.toFixed(3)),
  };
}

const results = {};
for (const s of SCENARIOS) {
  if (only.length && !only.includes(s.id)) continue;
  if (s.before) await s.before();
  const t0 = Date.now();
  const res = await fetch(`${BASE}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: { lat: s.from[0], lng: s.from[1] },
      destination: { lat: s.to[0], lng: s.to[1] },
      departure_time: AT,
    }),
  });
  const body = await res.json();
  results[s.id] = {
    name: s.name,
    http: res.status,
    ms: Date.now() - t0,
    routes: res.ok ? body.routes.map(summarize) : body,
    ...(s.expectMode ? { expectMode: s.expectMode } : {}),
  };
  const top = results[s.id].routes[0];
  console.log(
    `${s.id.padEnd(9)} HTTP ${res.status}  ${res.ok ? body.routes.length : 0} rute  #1: ` +
      (top?.route_id ? `${top.route_id} Rp${top.cost_idr} ${top.minutes.join("-")}mnt` : "-"),
  );
}
writeFileSync(OUT, JSON.stringify({ base: BASE, at: AT, results }, null, 2));
console.log(`-> ${OUT}`);
