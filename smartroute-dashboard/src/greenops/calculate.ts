// Task 4: hitungan GreenOps. Murni, tanpa UI.
//
// Jarak dihitung dari linimasa tiap trip (integral tepat), bukan dijumlahkan per
// tick. Jadi hasilnya tidak bergantung pada interval tampilan atau kecepatan putar.
import { DAY_SEC } from "../simulation/constants.ts";
import { distanceAt, type CompiledPattern, type Simulation } from "../simulation/engine.ts";
import type { ModeKey, Vehicle, WibTime } from "../simulation/types.ts";
import {
  CAR_G_PER_PKM,
  FACTORS,
  gramsPerVehicleKm,
  OCCUPANCY_SCENARIOS,
  type FactorModeKey,
  type OccupancyScenario,
} from "./greenopsFactors.ts";

export const NETWORK_MODES: ModeKey[] = ["mrt", "lrt_jabodebek", "krl", "brt", "bus", "mikrotrans"];

/** Kendaraan-meter satu pola dalam rentang detik [from, to] pada satu hari layanan. */
function metersInWindow(c: CompiledPattern, fromSec: number, toSec: number): number {
  const start = distanceAt(c, 0);
  const whole = distanceAt(c, c.tripSec) - start;
  let m = 0;
  const deps = c.departures;
  for (let i = 0; i < deps.length; i++) {
    const a = fromSec - deps[i];
    const b = toSec - deps[i];
    if (b <= 0) break;
    if (a >= c.tripSec) continue;
    if (a <= 0 && b >= c.tripSec) m += whole;
    else m += distanceAt(c, Math.min(b, c.tripSec)) - distanceAt(c, Math.max(a, 0));
  }
  return m;
}

/** Kendaraan-km per moda pada `dayIndex`, rentang [fromSec, toSec] (0..86400). */
export function vehicleKmByMode(
  sim: Simulation,
  dayIndex: number,
  fromSec: number,
  toSec: number,
): Record<ModeKey, number> {
  const out = Object.fromEntries(NETWORK_MODES.map((m) => [m, 0])) as Record<ModeKey, number>;
  const yesterday = (dayIndex + 6) % 7;
  for (const c of sim.compiled) {
    const { days } = c.pattern.service;
    let m = 0;
    if (days[dayIndex]) m += metersInWindow(c, fromSec, toSec);
    // Trip kemarin yang masih berjalan lewat tengah malam.
    if (days[yesterday]) m += metersInWindow(c, fromSec + DAY_SEC, toSec + DAY_SEC);
    out[c.pattern.mode] += m / 1000;
  }
  return out;
}

export interface EnergyEmission {
  /** Jumlah energi; null bila moda tanpa faktor. */
  energy: number | null;
  energyUnit: "kWh" | "L" | null;
  kgCo2: number | null;
}

export function energyEmission(mode: FactorModeKey, vehicleKm: number): EnergyEmission {
  const f = FACTORS[mode];
  const g = gramsPerVehicleKm(mode);
  if (g === null || !f.energy) return { energy: null, energyUnit: null, kgCo2: null };
  return {
    energy: f.energy.value * vehicleKm,
    energyUnit: f.energy.carrier === "listrik" ? "kWh" : "L",
    kgCo2: (g * vehicleKm) / 1000,
  };
}

export interface VehicleEstimate {
  distanceKm: number;
  energyPerKm: { value: number; unit: string } | null;
  gPerKm: number | null;
  tripKgCo2: number | null;
}

/** Kartu kendaraan: jarak trip berjalan sejauh ini × faktor. */
export function vehicleEstimate(v: Pick<Vehicle, "mode" | "distanceM">): VehicleEstimate {
  const f = FACTORS[v.mode];
  const g = gramsPerVehicleKm(v.mode);
  const distanceKm = v.distanceM / 1000;
  return {
    distanceKm,
    energyPerKm: f.energy ? { value: f.energy.value, unit: f.energy.unit } : null,
    gPerKm: g,
    tripKgCo2: g === null ? null : (g * distanceKm) / 1000,
  };
}

export interface ModeRow extends EnergyEmission {
  mode: ModeKey;
  label: string;
  available: boolean;
  activeVehicles: number;
  /** Kendaraan-km dalam 60 menit terakhir waktu simulasi. */
  vkmLastHour: number;
  hour: EnergyEmission;
  /** Kendaraan-km sejak 00:00 hari simulasi. */
  vkmToday: number;
  today: EnergyEmission;
}

export interface FleetTotals {
  activeVehicles: number;
  kgCo2LastHour: number;
  kgCo2Today: number;
  kwhLastHour: number;
  kwhToday: number;
  litersLastHour: number;
  litersToday: number;
  /** Kendaraan yang tidak ikut dihitung karena modanya tanpa faktor. */
  excludedVehicles: number;
  excludedModes: string[];
}

export function modeRows(sim: Simulation, time: WibTime, active: Vehicle[]): { rows: ModeRow[]; totals: FleetTotals } {
  const hourFrom = Math.max(0, time.secOfDay - 3600);
  const hourKm = vehicleKmByMode(sim, time.dayIndex, hourFrom, time.secOfDay);
  const todayKm = vehicleKmByMode(sim, time.dayIndex, 0, time.secOfDay);
  const counts = Object.fromEntries(NETWORK_MODES.map((m) => [m, 0])) as Record<ModeKey, number>;
  for (const v of active) counts[v.mode]++;

  const rows: ModeRow[] = NETWORK_MODES.map((mode) => {
    const hour = energyEmission(mode, hourKm[mode]);
    const today = energyEmission(mode, todayKm[mode]);
    return {
      mode,
      label: FACTORS[mode].label,
      available: FACTORS[mode].status === "tersedia",
      activeVehicles: counts[mode],
      vkmLastHour: hourKm[mode],
      hour,
      vkmToday: todayKm[mode],
      today,
      energy: today.energy,
      energyUnit: today.energyUnit,
      kgCo2: today.kgCo2,
    };
  });

  const totals: FleetTotals = {
    activeVehicles: active.length,
    kgCo2LastHour: 0,
    kgCo2Today: 0,
    kwhLastHour: 0,
    kwhToday: 0,
    litersLastHour: 0,
    litersToday: 0,
    excludedVehicles: 0,
    excludedModes: [],
  };
  for (const r of rows) {
    if (!r.available) {
      totals.excludedVehicles += r.activeVehicles;
      totals.excludedModes.push(r.label);
      continue;
    }
    totals.kgCo2LastHour += r.hour.kgCo2 ?? 0;
    totals.kgCo2Today += r.today.kgCo2 ?? 0;
    if (r.today.energyUnit === "kWh") {
      totals.kwhLastHour += r.hour.energy ?? 0;
      totals.kwhToday += r.today.energy ?? 0;
    } else {
      totals.litersLastHour += r.hour.energy ?? 0;
      totals.litersToday += r.today.energy ?? 0;
    }
  }
  return { rows, totals };
}

export interface PerPassengerRange {
  mode: FactorModeKey;
  /** g/pkm pada okupansi tinggi (batas bawah) dan rendah (batas atas). */
  lowG: number;
  highG: number;
  /** g/pkm pada skenario terpilih. */
  selectedG: number;
  occupancyShare: number;
  passengers: number;
}

/** Rentang per penumpang-km. ASUMSI okupansi, bukan hitungan penumpang. */
export function perPassengerRange(mode: FactorModeKey, scenario: OccupancyScenario): PerPassengerRange | null {
  const g = gramsPerVehicleKm(mode);
  const cap = FACTORS[mode].capacity?.passengers;
  if (g === null || !cap) return null;
  const at = (share: number) => g / (cap * share);
  const share = OCCUPANCY_SCENARIOS[scenario];
  return {
    mode,
    lowG: at(OCCUPANCY_SCENARIOS.tinggi),
    highG: at(OCCUPANCY_SCENARIOS.rendah),
    selectedG: at(share),
    occupancyShare: share,
    passengers: cap * share,
  };
}

export interface CarComparison {
  /** Penumpang-km skenario = kendaraan-km × kapasitas × okupansi. */
  pkm: number;
  transitKgCo2: number;
  carKgCo2: number;
}

/** Perbandingan skenario: orang yang sama, jarak yang sama, sendiri-sendiri naik mobil. */
export function carComparison(mode: FactorModeKey, vehicleKm: number, scenario: OccupancyScenario): CarComparison | null {
  const g = gramsPerVehicleKm(mode);
  const cap = FACTORS[mode].capacity?.passengers;
  if (g === null || !cap) return null;
  const pkm = vehicleKm * cap * OCCUPANCY_SCENARIOS[scenario];
  return { pkm, transitKgCo2: (g * vehicleKm) / 1000, carKgCo2: (pkm * CAR_G_PER_PKM) / 1000 };
}

/** Ringkasan CSV per moda per jam, satu hari jadwal. */
export function hourlyCsv(sim: Simulation, dayIndex: number): string {
  const lines = ["jam,moda,kendaraan_km,energi,satuan_energi,emisi_kg_co2,catatan"];
  const fmt = (n: number) => n.toFixed(1);
  for (let h = 0; h < 24; h++) {
    const km = vehicleKmByMode(sim, dayIndex, h * 3600, (h + 1) * 3600);
    for (const mode of NETWORK_MODES) {
      const e = energyEmission(mode, km[mode]);
      const hour = `${String(h).padStart(2, "0")}:00`;
      if (e.kgCo2 === null) {
        lines.push(`${hour},${FACTORS[mode].label},${fmt(km[mode])},,,,faktor tidak tersedia`);
      } else {
        lines.push(`${hour},${FACTORS[mode].label},${fmt(km[mode])},${fmt(e.energy!)},${e.energyUnit},${fmt(e.kgCo2)},estimasi dari simulasi jadwal`);
      }
    }
  }
  return lines.join("\n") + "\n";
}
