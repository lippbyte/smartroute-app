// Mesin simulasi posisi kendaraan berbasis jadwal. Posisi di sini DIHITUNG dari
// pola perjalanan, bukan data armada. Tidak memodelkan kemacetan: waktu tempuh
// hanya dari kecepatan rata-rata pola dan asumsi lama berhenti.
//
// Deterministik: waktu yang sama selalu menghasilkan snapshot yang sama.
import { DAY_SEC, DWELL_SEC, FLEET_MAX, FLEET_MIN, PEAK_WINDOWS } from "./constants.ts";
import type { Pattern, Vehicle, WibTime } from "./types.ts";

const EARTH_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(x));
}

function bearingDeg(a: readonly [number, number], b: readonly [number, number]): number {
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

/** Elemen terakhir yang <= nilai, atau -1. Array harus menaik. */
function upperIndex(arr: ArrayLike<number>, value: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function isPeak(secOfDay: number): boolean {
  const m = (secOfDay % DAY_SEC) / 60;
  return PEAK_WINDOWS.some(([a, b]) => m >= a && m < b);
}

/**
 * Pola yang sudah dihitung sebelumnya. Linimasa satu trip berupa potongan
 * berurutan: bergerak, berhenti, bergerak, ... dari saat berangkat.
 */
export interface CompiledPattern {
  pattern: Pattern;
  shapeCum: Float64Array;
  lengthM: number;
  /** Waktu mulai tiap potongan, detik sejak berangkat. */
  phaseStartSec: Float64Array;
  /** Jarak di awal tiap potongan, meter. */
  phaseStartDist: Float64Array;
  /** 1 bila potongan itu berhenti di halte. */
  phaseDwell: Uint8Array;
  /** Indeks halte berikutnya saat potongan berlangsung. */
  phaseNextStop: Int32Array;
  tripSec: number;
  fleetCap: number;
  /** Waktu keberangkatan satu hari, detik sejak 00:00, menaik. */
  departures: Int32Array;
}

/** max(2, min(14, ceil(durasi / headway tersibuk))). */
export function fleetCapFor(tripSec: number, headwaySec: number): number {
  return Math.max(FLEET_MIN, Math.min(FLEET_MAX, Math.ceil(tripSec / headwaySec)));
}

/**
 * Keberangkatan satu hari dari headway. Selangnya tidak pernah di bawah
 * durasi/batas armada, jadi rentang sepanjang satu trip berisi paling banyak
 * `fleetCap` keberangkatan.
 */
function departuresFromHeadway(p: Pattern, tripSec: number, fleetCap: number): number[] {
  const { startMin, endMin, headwayPeakMin, headwayOffMin } = p.service;
  const start = Math.round(startMin * 60);
  const end = Math.round(endMin * 60);
  const floorSec = Math.ceil(tripSec / fleetCap);
  const out: number[] = [];
  if (p.service.windows) {
    let t = 0;
    for (const [a, b, h] of p.service.windows) {
      t = Math.max(t, Math.round(a * 60));
      const stepSec = Math.max(1, Math.ceil(Math.max(h * 60, floorSec)));
      for (; t < Math.round(b * 60); t += stepSec) out.push(t);
    }
    return out;
  }
  let t = start;
  while (t < end) {
    out.push(t);
    const headwaySec = (isPeak(t) ? headwayPeakMin : headwayOffMin) * 60;
    t += Math.max(1, Math.ceil(Math.max(headwaySec, floorSec)));
  }
  return out;
}

/** Armada terbanyak yang berjalan bersamaan pada jadwal menaik ini. */
function maxConcurrent(departures: number[], tripSec: number): number {
  let best = 0;
  let first = 0;
  for (let i = 0; i < departures.length; i++) {
    while (departures[i] - departures[first] >= tripSec) first++;
    best = Math.max(best, i - first + 1);
  }
  return best;
}

/** Jadwal nyata dipakai utuh, kecuali trip yang melampaui batas armada. */
function limitConcurrency(departures: number[], tripSec: number, cap: number): number[] {
  const kept: number[] = [];
  for (const d of departures) {
    if (kept.length < cap || d - kept[kept.length - cap] >= tripSec) kept.push(d);
  }
  return kept;
}

function buildDepartures(p: Pattern, tripSec: number): { departures: Int32Array; fleetCap: number } {
  const timetable = p.service.departuresMin;
  if (timetable && timetable.length > 0) {
    const sorted = timetable.map((m) => Math.round(m * 60)).sort((a, b) => a - b);
    const fleetCap = Math.max(FLEET_MIN, Math.min(FLEET_MAX, maxConcurrent(sorted, tripSec)));
    return { departures: Int32Array.from(limitConcurrency(sorted, tripSec, fleetCap)), fleetCap };
  }
  const busiestMin = p.service.windows
    ? Math.min(...p.service.windows.map((w) => w[2]))
    : Math.min(p.service.headwayPeakMin, p.service.headwayOffMin);
  const fleetCap = fleetCapFor(tripSec, busiestMin * 60);
  return { departures: Int32Array.from(departuresFromHeadway(p, tripSec, fleetCap)), fleetCap };
}

export function compilePattern(p: Pattern): CompiledPattern {
  const shapeCum = new Float64Array(p.shape.length);
  for (let i = 1; i < p.shape.length; i++) {
    shapeCum[i] = shapeCum[i - 1] + haversineM(p.shape[i - 1], p.shape[i]);
  }
  const lengthM = shapeCum[shapeCum.length - 1];
  const mps = (p.speedKmh * 1000) / 3600;
  const dwell = DWELL_SEC[p.mode];
  const n = p.stopIds.length;

  const starts: number[] = [];
  const dists: number[] = [];
  const dwells: number[] = [];
  const nexts: number[] = [];
  let t = 0;
  for (let i = 1; i < n; i++) {
    const from = Math.min(p.stopDistM[i - 1], lengthM);
    const to = Math.min(p.stopDistM[i], lengthM);
    starts.push(t);
    dists.push(from);
    dwells.push(0);
    nexts.push(i);
    t += Math.max(0, to - from) / mps;
    if (i < n - 1) {
      starts.push(t);
      dists.push(to);
      dwells.push(1);
      nexts.push(i + 1);
      t += dwell;
    }
  }
  const tripSec = t;
  const { departures, fleetCap } = buildDepartures(p, tripSec);
  return {
    pattern: p,
    shapeCum,
    lengthM,
    phaseStartSec: Float64Array.from(starts),
    phaseStartDist: Float64Array.from(dists),
    phaseDwell: Uint8Array.from(dwells),
    phaseNextStop: Int32Array.from(nexts),
    tripSec,
    fleetCap,
    departures,
  };
}

/** Jarak yang sudah ditempuh setelah `elapsed` detik sejak berangkat. */
export function distanceAt(c: CompiledPattern, elapsed: number): number {
  if (elapsed <= 0) return Math.min(c.pattern.stopDistM[0], c.lengthM);
  if (elapsed >= c.tripSec) return Math.min(c.pattern.stopDistM[c.pattern.stopDistM.length - 1], c.lengthM);
  const i = upperIndex(c.phaseStartSec, elapsed);
  if (c.phaseDwell[i]) return c.phaseStartDist[i];
  const mps = (c.pattern.speedKmh * 1000) / 3600;
  return c.phaseStartDist[i] + (elapsed - c.phaseStartSec[i]) * mps;
}

function pointAt(c: CompiledPattern, dist: number): { lon: number; lat: number; bearing: number } {
  const shape = c.pattern.shape;
  const d = Math.max(0, Math.min(dist, c.lengthM));
  const i = Math.min(Math.max(upperIndex(c.shapeCum, d), 0), shape.length - 2);
  const span = c.shapeCum[i + 1] - c.shapeCum[i];
  const f = span > 0 ? (d - c.shapeCum[i]) / span : 0;
  return {
    lon: shape[i][0] + (shape[i + 1][0] - shape[i][0]) * f,
    lat: shape[i][1] + (shape[i + 1][1] - shape[i][1]) * f,
    bearing: bearingDeg(shape[i], shape[i + 1]) % 360,
  };
}

function vehicleAt(c: CompiledPattern, dayKey: number, depIndex: number, elapsed: number): Vehicle {
  const p = c.pattern;
  const clamped = Math.max(0, Math.min(elapsed, c.tripSec));
  const dist = distanceAt(c, clamped);
  const point = pointAt(c, dist);
  const phase = upperIndex(c.phaseStartSec, clamped);
  const arrived = elapsed >= c.tripSec;
  return {
    id: `${p.id}#${dayKey}-${depIndex}`,
    routeId: p.routeId,
    patternId: p.id,
    mode: p.mode,
    lon: point.lon,
    lat: point.lat,
    bearing: point.bearing,
    status: c.phaseDwell[phase] ? "berhenti" : "berjalan",
    nextStopId: arrived ? null : p.stopIds[c.phaseNextStop[phase]],
    progress: c.lengthM > 0 ? Math.min(1, dist / c.lengthM) : 0,
    distanceM: Math.max(0, dist - Math.min(p.stopDistM[0], c.lengthM)),
  };
}

/** Rentang indeks keberangkatan [dari, sampai] yang masih berjalan pada `tSec`. */
function activeRange(c: CompiledPattern, tSec: number): [number, number] {
  const last = upperIndex(c.departures, tSec);
  const first = upperIndex(c.departures, tSec - c.tripSec) + 1;
  return [first, last];
}

export interface Simulation {
  compiled: CompiledPattern[];
  byPatternId: Map<string, CompiledPattern>;
  getSnapshot(time: WibTime): Vehicle[];
}

export function createSimulation(patterns: Pattern[]): Simulation {
  const compiled = patterns.filter((p) => p.shape.length >= 2 && p.stopIds.length >= 2).map(compilePattern);
  return {
    compiled,
    byPatternId: new Map(compiled.map((c) => [c.pattern.id, c])),
    getSnapshot(time) {
      const out: Vehicle[] = [];
      const yesterday = (time.dayIndex + 6) % 7;
      for (const c of compiled) {
        const { days } = c.pattern.service;
        if (days[time.dayIndex]) {
          const [a, b] = activeRange(c, time.secOfDay);
          for (let i = a; i <= b; i++) {
            out.push(vehicleAt(c, time.dayIndex, i, time.secOfDay - c.departures[i]));
          }
        }
        // Trip yang berangkat kemarin dan melewati tengah malam.
        if (days[yesterday]) {
          const t = time.secOfDay + DAY_SEC;
          const [a, b] = activeRange(c, t);
          for (let i = a; i <= b; i++) {
            out.push(vehicleAt(c, yesterday, i, t - c.departures[i]));
          }
        }
      }
      return out;
    },
  };
}

/** Waktu WIB (UTC+7, tanpa musim panas) dari sebuah Date. */
export function toWibTime(date: Date): WibTime {
  const shifted = new Date(date.getTime() + 7 * 3600 * 1000);
  return {
    dayIndex: (shifted.getUTCDay() + 6) % 7,
    secOfDay: shifted.getUTCHours() * 3600 + shifted.getUTCMinutes() * 60 + shifted.getUTCSeconds(),
  };
}
