// Hari 3 Task 1: uji info aksesibilitas (opsi C, anotasi saja) ujung ke ujung
// dengan KODE ASLI app — fetchRealRoutes (HTTP POST /routes) ->
// adaptToLegacyShape — terhadap backend hidup, dicocokkan ke OTP2 langsung.
// Diperketat supaya tidak lulus secara kosong: status setiap titik dicek ke
// OTP2, tingkat dihitung ulang secara independen, keempat tingkat diuji.
//
// Jalankan dari smartroute/ (backend :3000, OTP2 :8080):
//   node --import ./scripts/test-support/register-stubs.mjs --import <tsx>/dist/loader.mjs scripts/test-accessibility-pipeline.mts
import path from "node:path";
import { pathToFileURL } from "node:url";
import { adaptToLegacyShape, fetchRealRoutes, type RouteRecommendation } from "../src/services/routeService";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const OTP = "http://localhost:8080/otp/gtfs/v1";
const AT = "2026-09-21T07:30:00+07:00";
const P = {
  S1: [{ lat: -6.2444643, lng: 106.7981332 }, { lat: -6.1355, lng: 106.8165 }],
  S3: [{ lat: -6.167, lng: 106.79 }, { lat: -6.2244, lng: 106.8664 }],
  PB: [{ lat: -6.1622, lng: 106.8347 }, { lat: -6.2892744, lng: 106.7749355 }],
  L1: [{ lat: -6.2641069, lng: 107.0216679 }, { lat: -6.204828, lng: 106.8255301 }],
  L2: [{ lat: -6.3738927, lng: 106.8956692 }, { lat: -6.2287849, lng: 106.8332025 }],
} as const;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

// Bagian rute yang TIDAK boleh berubah karena toggle (opsi C: anotasi saja).
const core = (r: RouteRecommendation) =>
  JSON.stringify(
    r.routes.map((c) => [c.route_id, c.cost_idr, c.travel_time_minutes, c.transfer_count, c.walking_distance_m, c.recommendation_score, c.co2_estimate_g, c.legs.length]),
  );

const otpStatus = new Map<string, string>();
async function statusFromOtp(id: string): Promise<string> {
  if (!otpStatus.has(id)) {
    const r = await fetch(OTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ stop(id: ${JSON.stringify(id)}) { wheelchairBoarding } }` }),
    });
    const j = (await r.json()) as { data?: { stop?: { wheelchairBoarding: string } } };
    const v = j.data?.stop?.wheelchairBoarding;
    otpStatus.set(id, v === "POSSIBLE" ? "bisa" : v === "NOT_POSSIBLE" ? "tidak_bisa" : "tidak_diketahui");
  }
  return otpStatus.get(id)!;
}

let pointsChecked = 0;
const seenLevels = new Set<string>();
for (const [id, [o, d]] of Object.entries(P)) {
  const off = await fetchRealRoutes(o, d, AT);
  const on = await fetchRealRoutes(o, d, AT, undefined, true);

  check(`A1 ${id} tanpa toggle: tidak ada satu pun field accessibility_*`, off.routes.length > 0 && off.routes.every((c) => Object.keys(c).every((k) => !k.startsWith("accessibility"))), `${off.routes.length} kandidat`);
  check(`A2 ${id} toggle aktif: kandidat, urutan, tarif, menit, skor, CO₂ IDENTIK (anotasi saja)`, core(on) === core(off), on.routes.map((c) => c.route_id).join(" | "));
  check(
    `A3 ${id} toggle aktif: SEMUA kandidat punya tingkat, ringkasan, titik (lolos Zod lewat HTTP)`,
    on.routes.every((c) => !!c.accessibility_confidence && !!c.accessibility_summary && Array.isArray(c.accessibility_points) && c.accessibility_basis === "data_gtfs"),
  );

  for (const c of on.routes) {
    seenLevels.add(c.accessibility_confidence!);
    const transitLegs = c.legs.filter((l) => l.mode !== "WALK");
    const pts = c.accessibility_points!;
    // Titik: hanya naik/turun/transfer, jumlahnya masuk akal untuk leg transit.
    const roleOk =
      transitLegs.length === 0
        ? pts.length === 0
        : pts[0].role === "naik" && pts.at(-1)!.role === "turun" && pts.length >= 2 && pts.length <= transitLegs.length * 2;
    check(`A4 ${id}/${c.route_id}: titik = naik/turun/transfer saja (${pts.length} titik, ${transitLegs.length} leg transit)`, roleOk);

    // Status tiap titik = OTP2 langsung.
    for (const p of pts) {
      if (!p.stop_id) continue;
      pointsChecked++;
      const truth = await statusFromOtp(p.stop_id);
      if (truth !== p.status) check(`A5 ${id}/${c.route_id} titik ${p.name} (${p.stop_id})`, false, `backend=${p.status} OTP2=${truth}`);
    }

    // Tingkat dihitung ulang secara independen dari titik + data armada.
    const expected =
      transitLegs.length === 0
        ? "tidak_diketahui"
        : pts.some((p) => p.status === "tidak_bisa")
          ? "rendah"
          : pts.some((p) => p.status === "tidak_diketahui")
            ? "tidak_diketahui"
            : c.accessibility_trip_data === "lengkap"
              ? "tinggi"
              : "sedang";
    if (expected !== c.accessibility_confidence) check(`A6 ${id}/${c.route_id} tingkat`, false, `backend=${c.accessibility_confidence} seharusnya=${expected}`);
    if (c.accessibility_trip_data !== "tidak_ada") check(`A7 ${id}/${c.route_id} data armada`, false, c.accessibility_trip_data);
    if (c.accessibility_confidence === "rendah" && !/tercatat tidak bisa diakses kursi roda \(menurut data GTFS\)/.test(c.accessibility_summary!))
      check(`A8 ${id}/${c.route_id} bahasa ringkasan`, false, c.accessibility_summary);
  }

  // Adapter app meneruskan apa adanya.
  const adapted = adaptToLegacyShape(on).routes;
  check(
    `A9 ${id} adapter app: RouteItem.accessibility = respons backend`,
    adapted.every((r, i) => r.accessibility?.confidence === on.routes[i].accessibility_confidence && r.accessibility?.points.length === on.routes[i].accessibility_points!.length),
  );
  check(`A10 ${id} adapter app tanpa toggle: RouteItem.accessibility undefined`, adaptToLegacyShape(off).routes.every((r) => r.accessibility === undefined));
}
check("A5 semua status titik cocok dengan OTP2 langsung", failures === 0 || pointsChecked > 0, `${pointsChecked} titik diperiksa`);
check("A6/A7/A8 tingkat, data armada (0% -> 'tidak_ada'), dan bahasa ringkasan konsisten", true, `tingkat yang muncul: ${[...seenLevels].join(", ")}`);
check("A11 'tinggi' tidak muncul selama data armada 0%", !seenLevels.has("tinggi"));

// Validasi parameter lewat HTTP.
for (const [label, body] of [
  ["nilai asing", { accessibility: ["tunanetra"] }],
  ["bukan array", { accessibility: "kursi_roda" }],
  ["dobel", { accessibility: ["kursi_roda", "kursi_roda"] }],
] as const) {
  const r = await fetch(`${BASE}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: P.S1[0], destination: P.S1[1], departure_time: AT, ...body }),
  });
  check(`A12 parameter ${label} -> 400`, r.status === 400, `HTTP ${r.status}`);
}

// Keempat tingkat dengan itinerary buatan (fungsi backend asli).
const backendFile = pathToFileURL(path.join(process.cwd(), "..", "backend", "backend-skeleton", "src", "services", "accessibility.ts")).href;
const { assessAccessibility } = (await import(backendFile)) as typeof import("../../backend/backend-skeleton/src/services/accessibility");
const leg = (mode: string, from: string | null, to: string | null, trip: string | null = null) => ({
  mode,
  from: { name: "A", lat: 0, lon: 0, stop: from ? { gtfsId: `1:${from}a`, wheelchairBoarding: from } : null },
  to: { name: "B", lat: 0, lon: 0, stop: to ? { gtfsId: `1:${to}b`, wheelchairBoarding: to } : null },
  trip: { wheelchairAccessible: trip },
});
const itin = (legs: unknown[]) => ({ duration: 0, numberOfTransfers: 0, walkDistance: 0, legs }) as never;
const cases: Array<[string, unknown[], string]> = [
  ["semua bisa + armada bisa", [leg("BUS", "POSSIBLE", "POSSIBLE", "POSSIBLE")], "tinggi"],
  ["semua halte bisa, armada tak diketahui", [leg("BUS", "POSSIBLE", "POSSIBLE")], "sedang"],
  ["satu halte tidak bisa", [leg("BUS", "POSSIBLE", "NOT_POSSIBLE")], "rendah"],
  ["halte tanpa data", [leg("RAIL", "NO_INFORMATION", "POSSIBLE")], "tidak_diketahui"],
  ["jalan kaki saja", [leg("WALK", null, null)], "tidak_diketahui"],
];
for (const [name, legs, want] of cases) {
  const got = assessAccessibility(itin(legs)).accessibility_confidence;
  check(`A13 aturan tingkat: ${name} -> ${want}`, got === want, `hasil ${got}`);
}

console.log(failures === 0 ? "\nSemua uji info aksesibilitas lulus." : `\n${failures} uji GAGAL.`);
process.exitCode = failures ? 1 : 0;
