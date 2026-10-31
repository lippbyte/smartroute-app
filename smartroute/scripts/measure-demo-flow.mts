// Hari 4 Task 3: angka runbook investor dari KODE ASLI app — apa yang
// dirender layar (kartu hasil, detail, Trip Pass, info aksesibilitas) untuk
// skenario demo, plus latensi tiap panggilan. Tidak mengubah data akun.
//
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs \
//        scripts/measure-demo-flow.mts [departure_time ISO | now] [out.json]
//
// PERINGATAN: skenario S2 MENGIRIM laporan "padat" Monas (seperti di demo) —
// restart backend sesudahnya supaya S1 kembali normal.
import { writeFileSync } from "node:fs";
import { submitCrowdReport } from "../src/services/crowdService";
import { adaptToLegacyShape, fetchRealRoutes } from "../src/services/routeService";
import { a11yBanner } from "../src/utils/a11yDisplay";
import { formatCo2, percentVs } from "../src/utils/co2Format";
import { computeRouteBadges } from "../src/utils/routeBadges";
import { formatRange } from "../src/utils/tripFormat";
import type { RouteItem } from "../src/type";

const argAt = process.argv[2] ?? "2026-09-21T07:30:00+07:00";
const AT = argAt === "now" ? undefined : argAt;
const OUT = process.argv[3];

// Sama dengan getRouteTypeLabel di app/(tabs)/route/index.tsx.
const typeLabel = (i: RouteItem) =>
  (i.recommendation_score ?? 0) >= 0.9 ? "Rekomendasi" : i.travel_time_minutes <= 30 ? "Cepat" : i.cost_idr <= 4000 ? "Murah" : i.crowd?.predicted_level === "LOW" ? "Tenang" : "Nyaman";
const clock = (iso?: string) => iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;

async function scenario(id: string, from: [number, number], to: [number, number], opts: { a11y?: boolean } = {}) {
  const t0 = Date.now();
  const rec = await fetchRealRoutes({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] }, AT, undefined, opts.a11y ?? false);
  const ms = Date.now() - t0;
  const shaped = adaptToLegacyShape(rec, { origin: "A", destination: "B" });
  const badges = computeRouteBadges(shaped.routes, null); // IQAir tidak ada -> tanpa lencana udara
  const cards = shaped.routes
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      route_id: r.route_id,
      label: typeLabel(r),
      badge: badges[r.route_id]?.label ?? null,
      score10: r.recommendation_score != null ? Math.round(r.recommendation_score * 10) : null,
      card_minutes: r.travel_time_minutes,
      // Teks menit di kartu hasil (sama dengan app/(tabs)/route/index.tsx).
      card_text: formatRange(r.travel_time_range) ?? `${r.travel_time_minutes} mnt`,
      range: r.travel_time_range ? `${r.travel_time_range.min}–${r.travel_time_range.max}` : null,
      clock: `${clock(r.legs[0]?.depart_at)}–${clock(r.legs.at(-1)?.arrive_at)}`,
      transfers: r.transfers,
      cost_idr: r.cost_idr,
      co2: r.co2 ? `≈ ${formatCo2(r.co2.estimate_g)} CO₂${percentVs(r.co2.estimate_g, r.co2.car_g) ? ` · ${percentVs(r.co2.estimate_g, r.co2.car_g)} vs mobil sendirian` : ""}` : null,
      reliability_pct: r.reliability ? Math.round(r.reliability.score * 100) : null,
      comfort_pct: r.comfort_score != null ? Math.round(r.comfort_score * 100) : null,
      crowd: r.crowd?.predicted_level ?? null,
      fares: (r.fare_breakdown ?? []).map((f) => `${f.label}: ${f.fare_idr == null ? "?" : `Rp${f.fare_idr}`}`),
      a11y: r.accessibility ? `${r.accessibility.confidence} — ${r.accessibility.summary}` : null,
    }));
  const banner = opts.a11y ? a11yBanner(shaped.routes) : null;
  return { id, ms, departure_time: rec.departure_time, cards, banner };
}

const P = {
  blokM: [-6.2444643, 106.7981332] as [number, number],
  kota: [-6.1355, 106.8165] as [number, number],
  pasarBaru: [-6.1622, 106.8347] as [number, number],
  lebakBulus: [-6.2892744, 106.7749355] as [number, number],
};

const results = [];
results.push(await scenario("S1", P.blokM, P.kota));
results.push(await scenario("S1+a11y", P.blokM, P.kota, { a11y: true }));
results.push(await scenario("S2-sebelum", P.pasarBaru, P.lebakBulus));
const t0 = Date.now();
await submitCrowdReport("1:G00753", "high"); // seperti melapor dari UI
const reportMs = Date.now() - t0;
results.push(await scenario("S2-sesudah-Monas", P.pasarBaru, P.lebakBulus));

for (const r of results) {
  console.log(`\n== ${r.id} (${r.ms} ms, berangkat ${r.departure_time})`);
  for (const c of r.cards) {
    console.log(
      `  #${r.cards.indexOf(c) + 1} ${c.route_id} [${c.label}${c.badge ? ` · ${c.badge}` : ""}] ${c.score10}/10 · kartu ${c.card_text} (${c.clock}) · ${c.transfers}x transit · Rp${c.cost_idr} · ${c.co2} · reliabilitas ${c.reliability_pct}% · kenyamanan ${c.comfort_pct}%${c.crowd ? ` · crowd ${c.crowd}` : ""}`,
    );
    console.log(`      tarif: ${c.fares.join(" | ")}`);
    if (c.a11y) console.log(`      a11y: ${c.a11y}`);
  }
  if (r.banner) console.log(`  banner a11y: ${JSON.stringify(r.banner)}`);
}
console.log(`\nlapor Monas (POST /crowd-reports): ${reportMs} ms`);
if (OUT) writeFileSync(OUT, JSON.stringify({ at: AT ?? "now", reportMs, results }, null, 2));
