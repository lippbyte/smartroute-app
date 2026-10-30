// Hari 2 Task 3: uji lencana & teks CO₂ kartu dengan KODE ASLI app
// (routeBadges.ts, co2Format.ts, adaptToLegacyShape) pada respons /routes
// ASLI S1 & S3, dengan AQI tiruan: Baik, Tidak sehat, tanpa data, stale.
//
// Jalankan dari smartroute/ (backend di :3000):
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-route-badges.mts
import { adaptToLegacyShape, type RouteRecommendation } from "../src/services/routeService";
import { formatCo2, percentVs } from "../src/utils/co2Format";
import { computeRouteBadges, WALK_MODERATE_MAX_M, WALK_MODERATE_MIN_M } from "../src/utils/routeBadges";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AT = "2026-09-21T07:30:00+07:00";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function routes(o: [number, number], d: [number, number]): Promise<RouteRecommendation> {
  const res = await fetch(`${BASE}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: { lat: o[0], lng: o[1] }, destination: { lat: d[0], lng: d[1] }, departure_time: AT }),
  });
  return (await res.json()) as RouteRecommendation;
}

const rawS1 = await routes([-6.2444643, 106.7981332], [-6.1355, 106.8165]);
const rawS3 = await routes([-6.167, 106.79], [-6.2244, 106.8664]);
const s1 = adaptToLegacyShape(rawS1).routes;
const s3 = adaptToLegacyShape(rawS3).routes;
const describe = (rs: typeof s1) => rs.map((r) => `${r.route_id}: co2=${r.co2?.estimate_g} jalan=${r.walking_distance_m}`).join(" | ");
console.log(`S1 → ${describe(s1)}\nS3 → ${describe(s3)}\n`);

// --- Teks CO₂ kartu konsisten dengan respons backend.
for (const [name, adapted, raw] of [["S1", s1, rawS1], ["S3", s3, rawS3]] as const) {
  const ok = adapted.every((r, i) => {
    const b = raw.routes[i];
    const pct = Math.round((b.co2_estimate_g! / b.co2_car_g! - 1) * 100);
    return formatCo2(r.co2!.estimate_g) === (b.co2_estimate_g! < 1000 ? `${b.co2_estimate_g} g` : formatCo2(b.co2_estimate_g!)) && percentVs(r.co2!.estimate_g, r.co2!.car_g) === `−${Math.abs(pct)}%`;
  });
  check(`K1 ${name}: teks "≈ X g CO₂" dan "−Y% vs mobil sendirian" = respons backend`, ok, adapted.map((r) => `${formatCo2(r.co2!.estimate_g)} ${percentVs(r.co2!.estimate_g, r.co2!.car_g)}`).join(", "));
}

// Harapan dihitung dari data (bukan di-hardcode), dengan aturan yang sama
// seperti dokumen: hijau = CO₂ min (tie: rank, id); lencana udara pindah
// dari rute "Paling hijau".
const byRankThenId = (a: (typeof s1)[0], b: (typeof s1)[0]) => a.rank - b.rank || a.route_id.localeCompare(b.route_id);
const greenestOf = (rs: typeof s1) => [...rs].sort((a, b) => a.co2!.estimate_g - b.co2!.estimate_g || byRankThenId(a, b))[0].route_id;

for (const [name, rs] of [["S1", s1], ["S3", s3]] as const) {
  const green = greenestOf(rs);
  const moderate = rs.filter((r) => r.route_id !== green && r.walking_distance_m >= WALK_MODERATE_MIN_M && r.walking_distance_m <= WALK_MODERATE_MAX_M).sort(byRankThenId)[0]?.route_id;
  const leastWalk = rs.filter((r) => r.route_id !== green).sort((a, b) => a.walking_distance_m - b.walking_distance_m || byRankThenId(a, b))[0]?.route_id;

  const good = computeRouteBadges(rs, { category_key: "baik", stale: false });
  const bad = computeRouteBadges(rs, { category_key: "tidak_sehat", stale: false });
  const none = computeRouteBadges(rs, null);
  const stale = computeRouteBadges(rs, { category_key: "baik", stale: true });
  const fmt = (b: Record<string, { label: string }>) => Object.entries(b).map(([k, v]) => `${k}=${v.label}`).join(", ");

  check(`B1 ${name} AQI Baik: Paling hijau = ${green}`, good[green]?.kind === "paling_hijau", fmt(good));
  check(
    `B2 ${name} AQI Baik: "Aktif sehat" = rute jalan ${WALK_MODERATE_MIN_M}–${WALK_MODERATE_MAX_M} m berikutnya (${moderate ?? "tidak ada"})`,
    moderate ? good[moderate]?.kind === "aktif_sehat" : !Object.values(good).some((b) => b.kind === "aktif_sehat"),
  );
  check(`B3 ${name} AQI Tidak sehat: "Minim paparan" = jalan kaki terpendek selain rute terhijau (${leastWalk})`, !!leastWalk && bad[leastWalk]?.kind === "minim_paparan", fmt(bad));
  check(`B4 ${name} AQI Tidak sehat: tidak ada "Aktif sehat"`, !Object.values(bad).some((b) => b.kind === "aktif_sehat"));
  check(`B5 ${name} tanpa data AQI: hanya "Paling hijau", tanpa lencana udara, tanpa galat`, fmt(none) === `${green}=Paling hijau`, fmt(none));
  check(`B6 ${name} AQI stale: tanpa lencana udara`, fmt(stale) === `${green}=Paling hijau`, fmt(stale));
  const shuffled = computeRouteBadges([...rs].reverse(), { category_key: "baik", stale: false });
  check(`B7 ${name} deterministik: urutan masukan dibalik -> lencana sama`, fmt(shuffled.constructor === Object ? Object.fromEntries(Object.entries(shuffled).sort()) : shuffled) === fmt(Object.fromEntries(Object.entries(good).sort())));
  check(`B8 ${name} maks. satu lencana per rute & tidak mengubah urutan rute`, rs.every((r, i) => r.rank === i + 1) && Object.keys(good).length <= rs.length);
}

// Bentrok: rute terhijau JUGA satu-satunya rute berjalan kaki sedang -> lencana udara tidak dipasang ke rute itu.
const clash = computeRouteBadges(
  [
    { route_id: "A", rank: 1, walking_distance_m: 1000, co2: { estimate_g: 100 } as never },
    { route_id: "B", rank: 2, walking_distance_m: 3000, co2: { estimate_g: 500 } as never },
  ],
  { category_key: "sedang", stale: false },
);
check('B9 bentrok: "Paling hijau" menang, "Aktif sehat" tidak dipaksakan ke rute lain yang tidak memenuhi syarat', clash.A?.kind === "paling_hijau" && !clash.B, JSON.stringify(clash));

console.log(failures === 0 ? "\nSemua uji lencana & teks CO₂ lulus." : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
