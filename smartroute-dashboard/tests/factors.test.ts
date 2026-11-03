// Task 1: tabel faktor. Tidak bergantung pada simulasi.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALL_FACTOR_MODES, EXISTING_G_PER_PKM, FACTORS, FACTORS_APPROVED, gramsPerVehicleKm } from "../src/greenops/greenopsFactors.ts";

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

test("tabel perbandingan di dokumen sama dengan modul", () => {
  const doc = readFileSync(new URL("../../task/Dashboard_GreenOps_Tabel_Faktor.md", import.meta.url), "utf8");
  const f1 = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rowOf = (label: string) => doc.split("\n").find((l) => l.startsWith(`| ${label} |`) && l.split("|").length === 10);
  for (const mode of ["mrt", "krl", "brt", "bus"] as const) {
    const f = FACTORS[mode];
    const row = rowOf(f.label);
    assert.ok(row, f.label);
    const cap = f.capacity!.passengers;
    const g = gramsPerVehicleKm(mode)!;
    const app = EXISTING_G_PER_PKM[mode]!;
    const cells = row.split("|").map((c) => c.trim());
    assert.equal(cells[2].split(" ")[0], String(app), `${mode}: angka app`);
    assert.equal(cells[4], f1(g / (cap * 0.25)), `${mode}: 25%`);
    assert.equal(cells[5], f1(g / (cap * 0.5)), `${mode}: 50%`);
    assert.equal(cells[6], f1(g / (cap * 0.75)), `${mode}: 75%`);
    const pct = Math.round((g / (cap * 0.5) / app - 1) * 100);
    assert.equal(cells[7], `${pct > 0 ? "+" : ""}${pct}%`, `${mode}: selisih`);
    assert.equal(cells[8], `${Math.round((g / (app * cap)) * 100)}%`, `${mode}: okupansi impas`);
  }
  // Moda tanpa faktor tidak boleh punya angka di tabel.
  for (const mode of ["lrt_jakarta", "lrt_jabodebek", "whoosh", "mikrotrans"] as const) {
    assert.equal(gramsPerVehicleKm(mode), null);
    const cells = rowOf(FACTORS[mode].label)!.split("|").map((c) => c.trim());
    assert.deepEqual(cells.slice(4, 7), ["tidak tersedia", "tidak tersedia", "tidak tersedia"], mode);
  }
});

test("FACTORS_APPROVED tetap false sampai Khalifa menyetujui tabel faktor", () => {
  // Ubah uji ini bersamaan dengan persetujuan, bukan sebelumnya.
  assert.equal(FACTORS_APPROVED, false);
});
