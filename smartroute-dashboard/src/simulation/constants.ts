// Asumsi mesin simulasi. Bukan pengukuran. Nilai dwell ikut dipakai
// scripts/build_network.py saat menurunkan kecepatan dari stop_times GTFS,
// jadi perubahan di sini harus diikuti di sana lalu data dibangun ulang.
import type { ModeKey } from "./types.ts";

/** Lama berhenti di halte antara, detik. ASUMSI, tidak ada di data GTFS. */
export const DWELL_SEC: Record<ModeKey, number> = {
  mrt: 25,
  lrt_jabodebek: 25,
  krl: 25,
  brt: 20,
  bus: 15,
  mikrotrans: 15,
};

/** Jam sibuk WIB, menit sejak 00:00: 07:00-09:00 dan 17:00-19:30. */
export const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [420, 540],
  [1020, 1170],
];

/** Batas armada per pola, supaya data headway yang janggal tidak meledak. */
export const FLEET_MIN = 2;
export const FLEET_MAX = 14;

export const DAY_SEC = 86400;
