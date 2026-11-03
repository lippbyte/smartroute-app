import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  carComparison,
  energyEmission,
  hourlyCsv,
  modeRows,
  perPassengerRange,
  vehicleEstimate,
  vehicleKmByMode,
} from "../src/greenops/calculate.ts";
import {
  BUS_12M_LITER_PER_KM,
  DIESEL_G_PER_LITER,
  GRID_G_PER_KWH,
  gramsPerVehicleKm,
  MRT_TRAIN_KM_PER_YEAR,
} from "../src/greenops/greenopsFactors.ts";
import { createSimulation } from "../src/simulation/engine.ts";
import type { Network, Pattern } from "../src/simulation/types.ts";

const network: Network = JSON.parse(readFileSync(new URL("../public/data/network.json", import.meta.url), "utf8"));
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test("km-kereta MRT per tahun dapat diulang dari data jaringan", () => {
  let week = 0;
  for (const p of network.patterns) {
    if (p.mode !== "mrt") continue;
    const perDay = p.service.departuresMin!.length * (p.stopDistM[p.stopDistM.length - 1] / 1000);
    week += perDay * p.service.days.filter(Boolean).length;
  }
  const annual = (week * 365.25) / 7;
  assert.ok(Math.abs(annual - MRT_TRAIN_KM_PER_YEAR) / MRT_TRAIN_KM_PER_YEAR < 0.005, `${annual}`);
});

// ---------- Task 4: uji hitung tangan ----------

test("kasus tangan 1: bus 12 m, 10 km", () => {
  // Energi: (4,5+4,49+4,94+4,6)/4 = 4,6325 kWh/km ÷ 9,69 kWh/L = 0,47807 L/km.
  near(BUS_12M_LITER_PER_KM, 0.47807, 0.0001);
  // Diesel: 74,1 g/MJ × 9,69 kWh/L × 3,6 MJ/kWh = 2.584,9 g/L.
  near(DIESEL_G_PER_LITER, 2584.92, 0.05);
  // Per km: 0,47807 × 2.584,92 = 1.235,8 g/km. 10 km = 12,358 kg; 4,7807 L.
  const e = energyEmission("brt", 10);
  near(gramsPerVehicleKm("brt")!, 1235.77, 0.1);
  near(e.kgCo2!, 12.358, 0.001);
  near(e.energy!, 4.7807, 0.001);
  assert.equal(e.energyUnit, "L");
});

test("kasus tangan 2: KRL 25 km", () => {
  // 17,856 kWh/km × 870 g/kWh = 15.534,72 g/km. 25 km = 388,368 kg; 446,4 kWh.
  assert.equal(GRID_G_PER_KWH, 870);
  const e = energyEmission("krl", 25);
  near(gramsPerVehicleKm("krl")!, 15534.72, 0.01);
  near(e.kgCo2!, 388.368, 0.001);
  near(e.energy!, 446.4, 0.01);
  assert.equal(e.energyUnit, "kWh");
});

test("kasus tangan 3: kartu kendaraan MRT, 14,65 km", () => {
  // 50.000.000 ÷ 1.418.853 = 35,2397 kWh/km × 870 = 30.658,6 g/km; × 14,65 km = 449,15 kg.
  const v = vehicleEstimate({ mode: "mrt", distanceM: 14650 });
  near(v.energyPerKm!.value, 35.2397, 0.001);
  near(v.gPerKm!, 30658.5, 1);
  near(v.tripKgCo2!, 449.15, 0.02);
  near(v.distanceKm, 14.65);
});

test("moda tanpa faktor tidak menghasilkan angka", () => {
  for (const m of ["mikrotrans", "lrt_jabodebek"] as const) {
    assert.deepEqual(energyEmission(m, 100), { energy: null, energyUnit: null, kgCo2: null });
    const v = vehicleEstimate({ mode: m, distanceM: 5000 });
    assert.equal(v.gPerKm, null);
    assert.equal(v.tripKgCo2, null);
    assert.equal(v.energyPerKm, null);
    assert.equal(perPassengerRange(m, "sedang"), null);
    assert.equal(carComparison(m, 100, "sedang"), null);
  }
});

const STRAIGHT: Pattern = {
  id: "T",
  routeId: "R",
  mode: "krl",
  headsign: "x",
  stopIds: ["A", "B"],
  stopDistM: [0, 10000],
  shape: [
    [106.8, 0],
    [106.8 + 10000 / 111194.93, 0],
  ],
  speedKmh: 36,
  service: { days: [true, false, false, false, false, false, false], startMin: 360, endMin: 361, headwayPeakMin: 60, headwayOffMin: 60 },
};

test("hanya kendaraan yang beroperasi dihitung: sebelum berangkat nol, tepat 1000 dtk = 10 km", () => {
  const sim = createSimulation([STRAIGHT]);
  const dep = 6 * 3600;
  near(vehicleKmByMode(sim, 0, 0, dep).krl, 0);
  near(vehicleKmByMode(sim, 0, dep, dep + 500).krl, 5, 0.01);
  near(vehicleKmByMode(sim, 0, 0, dep + 1000).krl, 10, 0.01);
  // Setelah tiba tidak bertambah lagi, dan hari tanpa layanan tetap nol.
  near(vehicleKmByMode(sim, 0, 0, 86400).krl, 10, 0.01);
  near(vehicleKmByMode(sim, 2, 0, 86400).krl, 0);
});

test("kumulatif tidak bergantung pada cara membagi waktu", () => {
  const sim = createSimulation(network.patterns.filter((p) => p.mode === "brt").slice(0, 40));
  const whole = vehicleKmByMode(sim, 0, 0, 43200).brt;
  let parts = 0;
  for (let t = 0; t < 43200; t += 3600) parts += vehicleKmByMode(sim, 0, t, t + 3600).brt;
  near(parts, whole, 0.01);
});

test("trip melewati tengah malam: jarak setelah 00:00 masuk hari berikutnya", () => {
  const p = { ...STRAIGHT, service: { ...STRAIGHT.service, startMin: 1435, endMin: 1436 } };
  const sim = createSimulation([p]);
  // Berangkat Senin 23:55 (300 dtk sebelum tengah malam): 3 km Senin, 7 km Selasa.
  near(vehicleKmByMode(sim, 0, 0, 86400).krl, 3, 0.01);
  near(vehicleKmByMode(sim, 1, 0, 86400).krl, 7, 0.01);
});

test("baris per moda: moda tanpa faktor dikecualikan dari total dan disebutkan", () => {
  const sim = createSimulation(network.patterns);
  const time = { dayIndex: 0, secOfDay: 8 * 3600 };
  const active = sim.getSnapshot(time);
  const { rows, totals } = modeRows(sim, time, active);
  const mikro = rows.find((r) => r.mode === "mikrotrans")!;
  assert.equal(mikro.available, false);
  assert.equal(mikro.hour.kgCo2, null);
  assert.equal(mikro.today.energy, null);
  assert.ok(totals.excludedModes.includes("Mikrotrans"));
  assert.ok(totals.excludedModes.includes("LRT Jabodebek"));
  const sum = rows.filter((r) => r.available).reduce((a, r) => a + r.today.kgCo2!, 0);
  near(totals.kgCo2Today, sum, 0.001);
  assert.ok(totals.kwhToday > 0 && totals.litersToday > 0);
  assert.equal(totals.activeVehicles, active.length);
  console.log(
    `  Senin 08:00: ${active.length} kendaraan, ${Math.round(totals.kgCo2LastHour)} kg CO₂/jam, ${Math.round(totals.kwhLastHour)} kWh/jam, ${Math.round(totals.litersLastHour)} L/jam`,
  );
});

test("aturan malam: km dan CO₂ BRT hari Senin sesuai skenario C yang disetujui", () => {
  const sim = createSimulation(network.patterns);
  const km = vehicleKmByMode(sim, 0, 0, 86400).brt;
  assert.ok(Math.abs(km - 217655) < 1, `${km}`);
  near((km * gramsPerVehicleKm("brt")!) / 1e6, 269.0, 0.05);
});

test("rentang per penumpang-km dan pembanding mobil", () => {
  // BRT: 1.235,77 g/km ÷ (50 × 0,5) = 49,43 g/pkm; rentang 32,95 sampai 98,86.
  const r = perPassengerRange("brt", "sedang")!;
  near(r.selectedG, 49.43, 0.01);
  near(r.lowG, 32.95, 0.01);
  near(r.highG, 98.86, 0.01);
  assert.equal(r.passengers, 25);
  // 100 km × 25 orang = 2.500 pkm × 170 g = 425 kg; bus 123,58 kg.
  const c = carComparison("brt", 100, "sedang")!;
  near(c.pkm, 2500);
  near(c.carKgCo2, 425);
  near(c.transitKgCo2, 123.58, 0.01);
});

test("CSV: 24 jam × 6 moda, moda tanpa faktor tanpa angka emisi", () => {
  const sim = createSimulation(network.patterns.filter((p) => ["krl", "mikrotrans"].includes(p.mode)));
  const lines = hourlyCsv(sim, 0).trim().split("\n");
  assert.equal(lines.length, 1 + 24 * 6);
  const mikro = lines.find((l) => l.startsWith("08:00,Mikrotrans"))!;
  assert.match(mikro, /,,,,faktor tidak tersedia$/);
  assert.match(lines.find((l) => l.startsWith("08:00,KRL"))!, /,kWh,[\d.]+,estimasi/);
});
