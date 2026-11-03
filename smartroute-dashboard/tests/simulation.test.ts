// Jalankan: npm test (node --test, tanpa dependensi baru).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DWELL_SEC, FLEET_MAX, FLEET_MIN } from "../src/simulation/constants.ts";
import { compilePattern, createSimulation, fleetCapFor, haversineM, toWibTime } from "../src/simulation/engine.ts";
import type { Network, Pattern, WibTime } from "../src/simulation/types.ts";

const network: Network = JSON.parse(readFileSync(new URL("../public/data/network.json", import.meta.url), "utf8"));
const MONDAY = 0;
const at = (h: number, m = 0, s = 0, dayIndex = MONDAY): WibTime => ({ dayIndex, secOfDay: h * 3600 + m * 60 + s });

// Jalur lurus 10 km ke timur dengan tiga halte, 36 km/j = 10 m/dtk.
const EAST_10KM_LON = 106.8 + 10000 / (111194.93 * Math.cos(0));
function toyPattern(over: Partial<Pattern> = {}): Pattern {
  return {
    id: "P",
    routeId: "R",
    mode: "krl",
    headsign: "Timur",
    stopIds: ["A", "B", "C"],
    stopDistM: [0, 5000, 10000],
    shape: [
      [106.8, 0],
      [EAST_10KM_LON, 0],
    ],
    speedKmh: 36,
    service: {
      days: [true, true, true, true, true, false, false],
      startMin: 360,
      endMin: 420,
      headwayPeakMin: 10,
      headwayOffMin: 10,
    },
    ...over,
  };
}

test("posisi awal jalur: kendaraan muncul di halte pertama tepat saat berangkat", () => {
  const sim = createSimulation([toyPattern()]);
  const [v] = sim.getSnapshot(at(6));
  assert.equal(v.status, "berjalan");
  assert.equal(v.nextStopId, "B");
  assert.ok(Math.abs(v.lon - 106.8) < 1e-9);
  assert.equal(v.progress, 0);
  assert.equal(v.distanceM, 0);
});

test("posisi akhir jalur: mendekati halte terakhir lalu hilang saat tiba", () => {
  const c = compilePattern(toyPattern());
  // 10000 m / 10 m/dtk + satu kali berhenti di halte antara.
  assert.ok(Math.abs(c.tripSec - (1000 + DWELL_SEC.krl)) < 1);
  const sim = createSimulation([toyPattern({ service: { ...toyPattern().service, endMin: 361 } })]);
  const almost = sim.getSnapshot({ dayIndex: MONDAY, secOfDay: 6 * 3600 + c.tripSec - 1 });
  assert.equal(almost.length, 1);
  assert.equal(almost[0].nextStopId, "C");
  assert.ok(almost[0].progress > 0.998);
  assert.ok(Math.abs(almost[0].lon - EAST_10KM_LON) < 0.001);
  assert.equal(sim.getSnapshot({ dayIndex: MONDAY, secOfDay: 6 * 3600 + c.tripSec + 1 }).length, 0);
});

test("kendaraan berhenti di halte selama waktu dwell, lalu berjalan lagi", () => {
  const sim = createSimulation([toyPattern({ service: { ...toyPattern().service, endMin: 361 } })]);
  const arrive = 6 * 3600 + 500; // 5000 m / 10 m/dtk
  const during = sim.getSnapshot({ dayIndex: MONDAY, secOfDay: arrive + 10 })[0];
  assert.equal(during.status, "berhenti");
  assert.equal(during.nextStopId, "C");
  assert.ok(Math.abs(during.progress - 0.5) < 0.001);
  const stillThere = sim.getSnapshot({ dayIndex: MONDAY, secOfDay: arrive + DWELL_SEC.krl - 1 })[0];
  assert.ok(Math.abs(stillThere.lon - during.lon) < 1e-9, "tidak bergerak selama dwell");
  assert.equal(sim.getSnapshot({ dayIndex: MONDAY, secOfDay: arrive + DWELL_SEC.krl + 1 })[0].status, "berjalan");
});

test("tidak ada kendaraan di luar jam dan hari layanan", () => {
  const sim = createSimulation([toyPattern()]);
  assert.equal(sim.getSnapshot(at(5, 59)).length, 0);
  assert.equal(sim.getSnapshot(at(8)).length, 0);
  assert.equal(sim.getSnapshot(at(6, 30, 0, 5)).length, 0, "Sabtu tidak beroperasi");
  assert.ok(sim.getSnapshot(at(6, 30)).length > 0);
});

test("MRT nyata: tidak beroperasi pukul 02:00", () => {
  const sim = createSimulation(network.patterns.filter((p) => p.mode === "mrt"));
  assert.equal(sim.getSnapshot(at(2)).length, 0);
  assert.ok(sim.getSnapshot(at(7, 30)).length > 0);
});

test("trip melewati tengah malam tetap berjalan pada hari berikutnya", () => {
  const p = toyPattern({ service: { ...toyPattern().service, startMin: 1435, endMin: 1436 } });
  const sim = createSimulation([p]);
  const v = sim.getSnapshot(at(0, 5, 0, 1));
  assert.equal(v.length, 1, "berangkat Senin 23:55, masih jalan Selasa 00:05");
  assert.ok(v[0].id.includes("#0-"));
});

test("deterministik: waktu sama, snapshot sama", () => {
  const sim = createSimulation(network.patterns);
  const a = sim.getSnapshot(at(7, 31, 7));
  const b = createSimulation(network.patterns).getSnapshot(at(7, 31, 7));
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
});

test("jumlah armada per pola tidak pernah melebihi batas, sepanjang hari", () => {
  const sim = createSimulation(network.patterns);
  for (const c of sim.compiled) {
    assert.ok(c.fleetCap >= FLEET_MIN && c.fleetCap <= FLEET_MAX, c.pattern.id);
  }
  for (let sec = 0; sec < 86400; sec += 600) {
    const count = new Map<string, number>();
    for (const v of sim.getSnapshot({ dayIndex: MONDAY, secOfDay: sec })) {
      const k = `${v.patternId}|${v.id.split("#")[1].split("-")[0]}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    for (const [k, n] of count) {
      const cap = sim.byPatternId.get(k.split("|")[0])!.fleetCap;
      assert.ok(n <= cap, `${k}: ${n} > ${cap} pada detik ${sec}`);
    }
  }
});

test("fleetCapFor mengikuti rumus dan batasnya", () => {
  assert.equal(fleetCapFor(600, 3600), FLEET_MIN);
  assert.equal(fleetCapFor(3600, 600), 6);
  assert.equal(fleetCapFor(36000, 60), FLEET_MAX);
});

test("MRT: 13 stasiun, ujung ke ujung mendekati jadwal GTFS", () => {
  const p = network.patterns.filter((x) => x.mode === "mrt" && x.stopIds.length === 13);
  assert.ok(p.length > 0);
  for (const pattern of p) {
    const minutes = compilePattern(pattern).tripSec / 60;
    assert.ok(Math.abs(minutes - 29.2) <= 1.5, `${pattern.id}: ${minutes.toFixed(1)} menit`);
    assert.ok(Math.abs(pattern.stopDistM[12] - 14650) < 300, "panjang lintas");
    console.log(`  ${pattern.id}: ${minutes.toFixed(1)} menit, ${(pattern.stopDistM[12] / 1000).toFixed(2)} km`);
  }
});

test("data: setiap pola punya jarak halte yang tidak menurun dan koordinat wajar", () => {
  for (const p of network.patterns) {
    for (let i = 1; i < p.stopDistM.length; i++) assert.ok(p.stopDistM[i] >= p.stopDistM[i - 1], p.id);
    assert.equal(p.stopIds.length, p.stopDistM.length, p.id);
    assert.ok(p.speedKmh > 0, p.id);
    assert.ok(p.service.headwayPeakMin > 0 && p.service.headwayOffMin > 0, p.id);
    for (const [lon, lat] of p.shape) assert.ok(lon > 105 && lon < 108 && lat > -8 && lat < -5, p.id);
  }
});

test("toWibTime memakai UTC+7 dan hari Senin = 0", () => {
  // Senin 3 Nov 2025... 2026-11-02 adalah Senin; 17:30 UTC = Selasa 00:30 WIB.
  const t = toWibTime(new Date("2026-11-02T17:30:00Z"));
  assert.equal(t.dayIndex, 1);
  assert.equal(t.secOfDay, 1800);
});

test("haversine: 1 derajat bujur di khatulistiwa sekitar 111 km", () => {
  assert.ok(Math.abs(haversineM([0, 0], [1, 0]) - 111195) < 10);
});

test("kinerja getSnapshot dilaporkan", () => {
  const measure = (label: string, patterns: Pattern[]) => {
    const t0 = performance.now();
    const sim = createSimulation(patterns);
    const compileMs = performance.now() - t0;
    let vehicles = 0;
    const t1 = performance.now();
    const rounds = 200;
    for (let i = 0; i < rounds; i++) vehicles = sim.getSnapshot({ dayIndex: MONDAY, secOfDay: 27000 + i }).length;
    const ms = (performance.now() - t1) / rounds;
    console.log(`  ${label}: ${vehicles} kendaraan, snapshot ${ms.toFixed(2)} ms, kompilasi ${compileMs.toFixed(0)} ms`);
    return { vehicles, ms };
  };
  const byModes = (...m: string[]) => network.patterns.filter((p) => m.includes(p.mode));
  const rail = measure("rel saja", byModes("mrt", "lrt_jabodebek", "krl"));
  const def = measure("rel + BRT", byModes("mrt", "lrt_jabodebek", "krl", "brt"));
  const noMikro = measure("tanpa Mikrotrans", byModes("mrt", "lrt_jabodebek", "krl", "brt", "bus"));
  const all = measure("semua moda", network.patterns);
  assert.ok(rail.vehicles > 50);
  assert.ok(def.ms < 50 && noMikro.ms < 50 && all.ms < 100, "snapshot harus jauh di bawah interval tampilan");
});

test("keberangkatan rel hari Senin sama dengan jadwal GTFS", () => {
  const sim = createSimulation(network.patterns);
  // Jumlah trip di trips.txt: KRL DAILY 985, MRT WEEKDAY 285, LRT WEEKDAY 425.
  const expected: Record<string, number> = { krl: 985, mrt: 285, lrt_jabodebek: 425 };
  for (const [mode, sched] of Object.entries(expected)) {
    let n = 0;
    for (const c of sim.compiled) {
      if (c.pattern.mode === mode && c.pattern.service.days[MONDAY]) n += c.departures.length;
    }
    console.log(`  ${mode}: ${n} keberangkatan simulasi, jadwal ${sched}`);
    // Trip yang berangkat di menit yang sama digabung; batas armada bisa membuang sedikit.
    assert.ok(Math.abs(n - sched) / sched <= 0.02, `${mode}: ${n} vs ${sched}`);
  }
});

test("armada simultan dilaporkan per jam", () => {
  const sim = createSimulation(network.patterns);
  for (const h of [3, 6, 7.5, 12, 18, 22]) {
    const snap = sim.getSnapshot({ dayIndex: MONDAY, secOfDay: h * 3600 });
    const by: Record<string, number> = {};
    for (const v of snap) by[v.mode] = (by[v.mode] ?? 0) + 1;
    console.log(`  jam ${h}: total ${snap.length}`, JSON.stringify(by));
  }
});
