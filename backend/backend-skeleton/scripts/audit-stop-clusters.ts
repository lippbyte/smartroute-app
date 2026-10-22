// scripts/audit-stop-clusters.ts
//
// Audit klaster peron (lihat src/services/stopClusters.ts) terhadap SELURUH
// graph OTP2 yang sedang hidup. Jalankan ulang setiap graph dibangun ulang:
//
//   npx tsx scripts/audit-stop-clusters.ts
//
// Yang dicari: halte dengan beberapa peron senama berdekatan (jebakan seperti
// "Monumen Nasional"), rantai klaster yang memanjang terlalu jauh, halte
// senama berjauhan yang SENGAJA tidak digabung, dan halte senama lintas
// operator yang berdekatan (juga sengaja tidak digabung).
import "dotenv/config";
import { getAllOtpStops, type OtpStop } from "../src/lib/otpClient";
import {
  buildStopClusters,
  CLUSTER_RADIUS_M,
  feedOf,
  haversineM,
  normalizeStopName,
} from "../src/services/stopClusters";

const FEED_NAME: Record<string, string> = { "1": "TJ", "2": "KRL", "3": "MRT" };
const RADII = [50, 100];
const DEMO_HALTE = ["Monumen Nasional", "Kwitang", "Grogol", "Blok M", "Bundaran HI",
  "Dukuh Atas", "Lebak Bulus", "Senen", "Harmoni", "Pasar Baru", "Juanda"];

async function main(): Promise<void> {
const stops = await getAllOtpStops();
const byId = new Map(stops.map((s) => [s.gtfsId, s]));
const feedLabel = (id: string) => FEED_NAME[feedOf(id)] ?? `feed ${feedOf(id)}`;

function diameter(ids: string[]): number {
  let d = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) d = Math.max(d, haversineM(byId.get(ids[i])!, byId.get(ids[j])!));
  return d;
}
function uniqueClusters(index: Map<string, string[]>): string[][] {
  return [...new Set(index.values())];
}

console.log(`Graph: ${stops.length} stop`);
for (const f of ["1", "2", "3"]) {
  console.log(`  ${FEED_NAME[f]}: ${stops.filter((s) => feedOf(s.gtfsId) === f).length} stop`);
}

// ---- 1. Jumlah klaster per radius & per feed ----------------------------
const byRadius = new Map<number, string[][]>();
console.log("\n1. KLASTER PERON (feed sama + nama sama + berdekatan)");
for (const r of RADII) {
  const cl = uniqueClusters(buildStopClusters(stops, r));
  byRadius.set(r, cl);
  const perFeed = (f: string) => cl.filter((c) => feedOf(c[0]) === f);
  console.log(`  radius ${r} m: ${cl.length} klaster, ${cl.reduce((n, c) => n + c.length, 0)} stop  ` +
    ["1", "2", "3"].map((f) => `${FEED_NAME[f]}=${perFeed(f).length}`).join(" "));
}

// ---- 2. Yang baru terbentuk di 100 m (jarak 50-100 m) ---------------------
const key = (c: string[]) => [...c].sort().join(",");
const at50 = new Set(byRadius.get(50)!.map(key));
const hanya100 = byRadius.get(100)!.filter((c) => !at50.has(key(c)));
console.log(`\n2. KLASTER YANG HANYA TERBENTUK DI 100 m (peron berjarak 50-100 m): ${hanya100.length}`);
for (const c of hanya100.sort((a, b) => diameter(b) - diameter(a)).slice(0, 12)) {
  console.log(`  ${feedLabel(c[0]).padEnd(4)} ${byId.get(c[0])!.name.padEnd(34)} ${c.length} peron, rentang ${diameter(c).toFixed(0)} m`);
}

// ---- 3. Klaster terbesar & cek rantai (chaining) ---------------------------
const cl100 = byRadius.get(CLUSTER_RADIUS_M)!;
console.log(`\n3. KLASTER TERBESAR di ${CLUSTER_RADIUS_M} m (cek rantai: rentang > 150 m = mencurigakan)`);
for (const c of [...cl100].sort((a, b) => b.length - a.length || diameter(b) - diameter(a)).slice(0, 12)) {
  const d = diameter(c);
  console.log(`  ${feedLabel(c[0]).padEnd(4)} ${byId.get(c[0])!.name.padEnd(34)} ${String(c.length).padStart(2)} peron, rentang ${d.toFixed(0).padStart(3)} m${d > 150 ? "  <-- RANTAI?" : ""}`);
}
const rantai = cl100.filter((c) => diameter(c) > 150);
console.log(`  total klaster berentang > 150 m: ${rantai.length}`);

// ---- 4. Senama tapi berjauhan: SENGAJA tidak digabung -----------------------
const idx100 = buildStopClusters(stops, CLUSTER_RADIUS_M);
const grup = new Map<string, OtpStop[]>();
for (const s of stops) {
  const k = `${feedOf(s.gtfsId)}|${normalizeStopName(s.name)}`;
  grup.set(k, [...(grup.get(k) ?? []), s]);
}
const terpisah: Array<{ nama: string; feed: string; jml: number; minJarak: number }> = [];
for (const g of grup.values()) {
  if (g.length < 2) continue;
  const roots = new Set(g.map((s) => key(idx100.get(s.gtfsId) ?? [s.gtfsId])));
  if (roots.size < 2) continue;
  let minJarak = Infinity;
  for (let i = 0; i < g.length; i++)
    for (let j = i + 1; j < g.length; j++) {
      const a = key(idx100.get(g[i].gtfsId) ?? [g[i].gtfsId]);
      const b = key(idx100.get(g[j].gtfsId) ?? [g[j].gtfsId]);
      if (a !== b) minJarak = Math.min(minJarak, haversineM(g[i], g[j]));
    }
  terpisah.push({ nama: g[0].name, feed: feedLabel(g[0].gtfsId), jml: roots.size, minJarak });
}
console.log(`\n4. HALTE SENAMA TAPI BERJAUHAN — tidak digabung: ${terpisah.length} nama`);
console.log("   (yang terdekat di bawah paling layak dicek: apakah memang halte berbeda?)");
for (const t of terpisah.sort((a, b) => a.minJarak - b.minJarak).slice(0, 10)) {
  console.log(`  ${t.feed.padEnd(4)} ${t.nama.padEnd(34)} ${t.jml} kelompok, terdekat ${t.minJarak.toFixed(0)} m`);
}

// ---- 5. Lintas operator senama & berdekatan: SENGAJA tidak digabung -------
const perNama = new Map<string, OtpStop[]>();
for (const s of stops) perNama.set(normalizeStopName(s.name), [...(perNama.get(normalizeStopName(s.name)) ?? []), s]);
const lintas: string[] = [];
for (const g of perNama.values()) {
  const feeds = new Set(g.map((s) => feedOf(s.gtfsId)));
  if (feeds.size < 2) continue;
  let best = Infinity, pair = "";
  for (const a of g) for (const b of g) {
    if (feedOf(a.gtfsId) >= feedOf(b.gtfsId)) continue;
    const d = haversineM(a, b);
    if (d < best) { best = d; pair = `${feedLabel(a.gtfsId)}<->${feedLabel(b.gtfsId)}`; }
  }
  if (best <= 150) lintas.push(`  ${g[0].name.padEnd(34)} ${pair.padEnd(9)} ${best.toFixed(0)} m`);
}
console.log(`\n5. SENAMA LINTAS OPERATOR, <=150 m — tidak digabung (antrean terpisah): ${lintas.length}`);
lintas.forEach((l) => console.log(l));

// ---- 6. Halte yang dipakai demo -------------------------------------------
console.log(`\n6. HALTE DEMO di radius ${CLUSTER_RADIUS_M} m`);
for (const nama of DEMO_HALTE) {
  const semua = stops.filter((s) => normalizeStopName(s.name) === normalizeStopName(nama));
  const kl = [...new Set(semua.map((s) => key(idx100.get(s.gtfsId) ?? [s.gtfsId])))];
  const ringkas = kl.map((k) => {
    const ids = k.split(",");
    return `${feedLabel(ids[0])}:${ids.length}${ids.length > 1 ? `(${diameter(ids).toFixed(0)}m)` : ""}`;
  }).join(" ");
  console.log(`  ${nama.padEnd(18)} ${String(semua.length).padStart(2)} stop -> ${kl.length} kelompok: ${ringkas}`);
}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
