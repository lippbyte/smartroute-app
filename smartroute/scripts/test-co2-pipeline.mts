// Hari 2 Task 1: uji pipeline COâ‚‚ ujung ke ujung dengan KODE ASLI app â€”
// HTTP /routes (backend hidup) -> adaptToLegacyShape (routeService.ts) ->
// buildTripInput + createTrip + getTrip (tripService.ts) -> POST/GET /trips.
// Tujuannya: tidak lulus secara kosong â€” setiap tahap harus membawa angka
// yang sama, dan angka backend harus cocok dengan hitungan manual.
//
// Jalankan dari folder smartroute/ (backend di :3000, akun demo sudah dibuat):
//   $env:EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-co2-pipeline.mts
import { randomBytes } from "node:crypto";
import { adaptToLegacyShape, type RouteRecommendation } from "../src/services/routeService";
import { buildTripInput, createTrip, getTrip, newClientRef } from "../src/services/tripService";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AT = "2026-09-21T07:30:00+07:00";
// Faktor yang DISETUJUI (Task 0 Hari 2) â€” ditulis ulang di sini secara
// sengaja, supaya uji menangkap perubahan faktor yang tidak disengaja.
const FACTORS: Record<string, number> = { WALK: 0, BUS: 36, RAIL: 41, SUBWAY: 19, TRAM: 19 };
const CAR = 170;
const MOTOR = 100;
const round10 = (g: number) => Math.round(g / 10) * 10;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function routes(o: [number, number], d: [number, number], modes?: string[]): Promise<RouteRecommendation> {
  const res = await fetch(`${BASE}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: { lat: o[0], lng: o[1] }, destination: { lat: d[0], lng: d[1] }, departure_time: AT, ...(modes ? { modes } : {}) }),
  });
  if (!res.ok) throw new Error(`/routes HTTP ${res.status}`);
  return (await res.json()) as RouteRecommendation;
}

const manual = (legs: Array<{ mode: string; distance_m?: number }>) => {
  const dist = legs.reduce((s, l) => s + (l.distance_m ?? 0), 0);
  const g = legs.reduce((s, l) => s + ((l.distance_m ?? 0) / 1000) * FACTORS[l.mode], 0);
  return { total: round10(g), car: round10((dist / 1000) * CAR), motor: round10((dist / 1000) * MOTOR), dist };
};

const s1 = await routes([-6.2444643, 106.7981332], [-6.1355, 106.8165]);
const s3 = await routes([-6.167, 106.79], [-6.2244, 106.8664]);
const pb = await routes([-6.1622, 106.8347], [-6.2892744, 106.7749355]);
const l2 = await routes([-6.3738927, 106.8956692], [-6.2287849, 106.8332025]);
const walkOnly = await routes([-6.2444643, 106.7981332], [-6.1355, 106.8165], ["RAIL"]);

// --- 1. HTTP: semua kandidat punya COâ‚‚ >= 0, cocok dengan hitungan manual.
const all = [...s1.routes, ...s3.routes, ...pb.routes, ...l2.routes, ...walkOnly.routes];
check(
  "C1 semua kandidat (S1, S3, PB, L2, jalan kaki) punya co2_estimate_g >= 0",
  all.length > 0 && all.every((c) => typeof c.co2_estimate_g === "number" && c.co2_estimate_g >= 0),
  `${all.length} kandidat`,
);
check(
  "C2 setiap kandidat: total/mobil/motor = hitungan manual per leg",
  all.every((c) => {
    const m = manual(c.legs);
    return c.co2_estimate_g === m.total && c.co2_car_g === m.car && c.co2_motorcycle_g === m.motor && c.co2_comparator_distance_m === m.dist;
  }),
);
const pureWalk = walkOnly.routes.find((c) => c.legs.every((l) => l.mode === "WALK"));
check("C3 rute jalan kaki murni = 0 g", !!pureWalk && pureWalk.co2_estimate_g === 0 && pureWalk.co2_car_g! > 0, pureWalk ? `${pureWalk.co2_comparator_distance_m} m, mobil ${pureWalk.co2_car_g} g` : "tidak ada rute jalan kaki murni");

// Rute campuran yang mencakup BUS + SUBWAY (Pasar Baru 2+1+M) dan RAIL + SUBWAY.
for (const [id, list, want] of [
  ["2+1+M", pb.routes, ["BUS", "SUBWAY"]],
  ["Bogor+Cikarang+M", pb.routes, ["RAIL", "SUBWAY"]],
  ["Cibubur Line", l2.routes, ["TRAM"]],
] as const) {
  const c = list.find((r) => r.route_id === id);
  if (!c) {
    check(`C4 rute campuran ${id} ada`, false, "tidak ditemukan");
    continue;
  }
  const lines = c.legs.map((l) => `${l.mode} ${((l.distance_m ?? 0) / 1000).toFixed(3)} km Ã— ${FACTORS[l.mode]}`);
  const m = manual(c.legs);
  check(
    `C4 ${id}: per leg dijumlahkan = ${m.total} g`,
    c.co2_estimate_g === m.total && want.every((mode) => (c.co2_by_mode?.[mode as "BUS"] ?? -1) >= 0 && c.legs.some((l) => l.mode === mode)),
    lines.join(" + "),
  );
}

// --- 2. Adapter app (routeService.adaptToLegacyShape).
const adapted = adaptToLegacyShape(s1, { origin: "Blok M", destination: "Kota" });
check(
  "C5 adapter meneruskan COâ‚‚ apa adanya ke RouteItem (S1, semua kandidat)",
  adapted.routes.every((r, i) => r.co2?.estimate_g === s1.routes[i].co2_estimate_g && r.co2?.car_g === s1.routes[i].co2_car_g && r.co2?.motorcycle_g === s1.routes[i].co2_motorcycle_g),
  adapted.routes.map((r) => `${r.route_id}=${r.co2?.estimate_g}`).join(", "),
);
const stripped = adaptToLegacyShape({ ...s1, routes: s1.routes.map(({ co2_estimate_g, ...rest }) => rest) as RouteRecommendation["routes"] });
check("C6 adapter TIDAK mengarang COâ‚‚ bila backend tidak mengirim", stripped.routes.every((r) => r.co2 === undefined));

// --- 3. POST /trips lewat tripService (kode app), lalu GET.
// Hari 4: akun uji sekali-pakai, BUKAN akun demo — dulu setiap jalan uji
// menambah perjalanan "Blok M (uji CO₂)" ke Riwayat akun demo.
const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `co2-${randomBytes(4).toString("hex")}@contoh.test`, password: randomBytes(12).toString("base64url"), name: "Uji CO2" }),
});
const token = ((await reg.json()) as { token: string }).token;
check("C7a akun uji sekali-pakai terdaftar (bukan akun demo)", reg.status === 201 && !!token, `HTTP ${reg.status}`);
const route = adapted.routes[0];
const input = buildTripInput({ clientRef: newClientRef(), route, originLabel: "Blok M (uji COâ‚‚)", destinationLabel: "Kota", actualMinutes: null });
check("C7 buildTripInput membawa co2_estimate_g dari rute", input.co2_estimate_g === route.co2?.estimate_g, `${input.co2_estimate_g} g`);
const saved = await createTrip(token, input);
const fetched = await getTrip(token, saved.id);
check("C8 POST /trips menyimpan & GET /trips/:id mengembalikan COâ‚‚ yang sama", saved.co2_estimate_g === route.co2?.estimate_g && fetched.co2_estimate_g === route.co2?.estimate_g, `${fetched.co2_estimate_g} g`);

console.log(failures === 0 ? "\nSemua uji pipeline COâ‚‚ lulus." : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
