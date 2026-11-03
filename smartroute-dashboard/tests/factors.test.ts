// Task 1: tabel faktor. Tidak bergantung pada simulasi.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALL_FACTOR_MODES, EXISTING_G_PER_PKM, FACTORS, gramsPerVehicleKm } from "../src/greenops/greenopsFactors.ts";

test("delapan moda dokumen tugas: masing-masing punya faktor atau status tidak tersedia", () => {
  const required = ["mrt", "lrt_jakarta", "lrt_jabodebek", "krl", "whoosh", "brt", "bus", "mikrotrans"];
  assert.deepEqual([...ALL_FACTOR_MODES].sort(), [...required].sort());
  for (const m of ALL_FACTOR_MODES) {
    const f = FACTORS[m];
    if (f.status === "tersedia") {
      assert.ok(f.energy && f.energy.value > 0, m);
      assert.ok(gramsPerVehicleKm(m)! > 0, m);
    } else {
      assert.equal(f.energy, null, m);
      assert.equal(gramsPerVehicleKm(m), null, m);
      assert.ok(f.unavailableReason, m);
    }
  }
});

test("setiap angka punya sumber: judul, URL https, tahun, kekuatan, asumsi", () => {
  for (const m of ALL_FACTOR_MODES) {
    const f = FACTORS[m];
    if (f.status === "tersedia") {
      assert.ok(f.sources.length >= 2, `${m}: sumber energi dan sumber faktor`);
      assert.ok(f.strength, m);
      assert.ok(f.assumptions.length > 10, m);
      assert.notEqual(f.scope, "Tidak ada", m);
    }
    for (const s of [...f.sources, ...(f.capacity ? [f.capacity.source] : [])]) {
      assert.match(s.url, /^https:\/\//, s.title);
      assert.ok(s.title && s.year && s.used, s.url);
    }
    if (f.capacity) assert.ok(f.capacity.passengers > 0 && f.capacity.basis, m);
  }
});

test("Mikrotrans dan Whoosh tidak dihitung", () => {
  assert.equal(FACTORS.mikrotrans.status, "tidak_tersedia");
  assert.equal(FACTORS.whoosh.status, "tidak_tersedia");
});

test("salinan faktor per penumpang-km sama dengan backend", () => {
  const src = readFileSync(
    new URL("../../backend/backend-skeleton/src/services/emissionFactors.ts", import.meta.url),
    "utf8",
  );
  const value = (key: string) => {
    const m = new RegExp(`\\b${key}: \\{[\\s\\S]*?g_per_pkm: (\\d+)`).exec(src);
    assert.ok(m, key);
    return Number(m![1]);
  };
  assert.equal(EXISTING_G_PER_PKM.mrt, value("SUBWAY"));
  assert.equal(EXISTING_G_PER_PKM.lrt_jabodebek, value("TRAM"));
  assert.equal(EXISTING_G_PER_PKM.krl, value("RAIL"));
  assert.equal(EXISTING_G_PER_PKM.brt, value("BUS"));
  assert.equal(value("car"), 170);
});
