import type { ModeKey } from "@/simulation/types";

export interface ModeMeta {
  key: ModeKey;
  label: string;
  color: string;
  /** Default menyala di peta. Bus lain dan Mikrotrans menambah ±4.000 titik. */
  defaultOn: boolean;
  rail: boolean;
}

export const MODE_META: ModeMeta[] = [
  { key: "mrt", label: "MRT Jakarta", color: "#38bdf8", defaultOn: true, rail: true },
  { key: "lrt_jabodebek", label: "LRT Jabodebek", color: "#c084fc", defaultOn: true, rail: true },
  { key: "krl", label: "KRL Commuter Line", color: "#f87171", defaultOn: true, rail: true },
  { key: "brt", label: "BRT TransJakarta", color: "#fbbf24", defaultOn: true, rail: false },
  { key: "bus", label: "Bus besar non-BRT", color: "#4ade80", defaultOn: false, rail: false },
  { key: "mikrotrans", label: "Mikrotrans", color: "#94a3b8", defaultOn: false, rail: false },
];

export const SIM_LABEL = "Posisi berdasarkan jadwal (simulasi)";
export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export const fmt0 = (n: number) => nf0.format(n);
export const fmt1 = (n: number) => nf1.format(n);
export const fmt2 = (n: number) => nf2.format(n);

export function clock(secOfDay: number): string {
  const h = Math.floor(secOfDay / 3600);
  const m = Math.floor((secOfDay % 3600) / 60);
  const s = Math.floor(secOfDay % 60);
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}
