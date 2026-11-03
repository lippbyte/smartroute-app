// Hotfix TOTO: tarif layanan khusus TransJakarta yang DITAMPILKAN /routes,
// dibandingkan dengan GTFS. Hanya membaca: tidak mengirim laporan, tidak mengubah
// data tarif. Membandingkan dengan GTFS saja; kecocokan ke tarif resmi operator
// tetap TODO:verifikasi.
//
//   node --import tsx scripts/check-tj-special-fares.mjs [baseUrl] [out.json]
//
// Butuh backend hidup dan OTP2. Untuk tiap rute: dari halte pertama pola terpanjangnya
// ke halte terjauh, jam sibuk & siang hari kerja, hanya bus lalu semua moda, sampai rute
// itu muncul sebagai kandidat. Rute yang tidak muncul dilaporkan apa adanya, bukan
// dianggap cocok.
import { writeFileSync } from "node:fs";
import { getRoutesInfo } from "../src/lib/gtfsFeed";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const OUT = process.argv[3] || null;
const OTP = process.env.OTP2_URL || "http://localhost:8080/otp/gtfs/v1";
const TIMES = ["2026-09-21T07:30:00+07:00", "2026-09-21T17:30:00+07:00", "2026-09-21T12:00:00+07:00"];
const CATEGORIES = ["Transjabodetabek", "Royaltrans"];

const gql = async (query) => (await (await fetch(OTP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json()).data;

async function endpoints(gtfsId) {
  const d = await gql(`{ route(id:"${gtfsId}") { patterns { stops { name lat lon } } } }`);
  const longest = (d.route?.patterns ?? []).sort((a, b) => b.stops.length - a.stops.length)[0];
  if (!longest || longest.stops.length < 2) return null;
  // Halte TERJAUH, bukan halte terakhir: banyak pola berupa putaran (awal = akhir),
  // sehingga asal & tujuan sama dan /routes kosong.
  const from = longest.stops[0];
  const dist = (s) => Math.hypot(s.lat - from.lat, s.lon - from.lon);
  const to = longest.stops.reduce((a, b) => (dist(b) > dist(a) ? b : a));
  return [from, to];
}

async function shown(route, from, to) {
  for (const departure_time of TIMES) {
    for (const modes of [["BUS"], undefined]) {
      const body = { origin: { lat: from.lat, lng: from.lon }, destination: { lat: to.lat, lng: to.lon }, departure_time, ...(modes ? { modes } : {}) };
      const r = await fetch(`${BASE}/routes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const { routes } = await r.json();
      for (const c of routes ?? []) {
        const i = c.legs.findIndex((l) => l.mode === "BUS" && l.route_name === route.shortName);
        if (i < 0) continue;
        const item = (c.fare_breakdown ?? []).find((f) => f.leg_indexes?.includes(i));
        return { candidate: c.route_id, category: c.legs[i].route_category, cost_idr: c.cost_idr, item: item ? { label: item.label, fare_idr: item.fare_idr } : null, departure_time };
      }
    }
  }
  return null;
}

const all = getRoutesInfo();
const rows = [];
for (const category of CATEGORIES) {
  for (const route of all.filter((r) => r.desc === category)) {
    const gtfsId = `1:${route.routeId}`;
    const ends = await endpoints(gtfsId).catch(() => null);
    const s = ends ? await shown(route, ends[0], ends[1]) : null;
    const status = !ends ? "TANPA-POLA" : !s ? "TIDAK-MUNCUL" : s.item?.fare_idr === route.fareIdr ? "SAMA" : "BERBEDA";
    rows.push({ category, route: route.shortName, name: route.longName, gtfs_fare: route.fareIdr, routes_fare: s?.item?.fare_idr ?? null, routes_label: s?.item?.label ?? null, routes_category: s?.category ?? null, cost_idr: s?.cost_idr ?? null, candidate: s?.candidate ?? null, status });
    console.log(`${category.padEnd(17)} ${String(route.shortName).padEnd(6)} GTFS Rp${route.fareIdr}  /routes ${s?.item ? `Rp${s.item.fare_idr} (${s.item.label}; kandidat ${s.candidate}, total Rp${s.cost_idr})` : "-"}  ${status}  ${route.longName}`);
  }
}
for (const category of CATEGORIES) {
  const r = rows.filter((x) => x.category === category);
  const by = (st) => r.filter((x) => x.status === st).length;
  console.log(`\n${category}: ${r.length} rute GTFS; SAMA ${by("SAMA")}, BERBEDA ${by("BERBEDA")}, TIDAK-MUNCUL ${by("TIDAK-MUNCUL")}, TANPA-POLA ${by("TANPA-POLA")}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 2));
process.exitCode = rows.some((x) => x.status === "BERBEDA") ? 1 : 0;
