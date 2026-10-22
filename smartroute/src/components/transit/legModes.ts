// SATU-SATUNYA tempat label, ikon, dan warna moda untuk leg rute (hasil
// rute, detail perjalanan, kartu navigasi). Mengganti label akhir cukup di
// file ini — komponen lain tidak boleh punya switch moda sendiri.
//
// Warna TransJakarta/JakLingko/MRT/LRT diambil dari transitMode.ts (skema
// peta halte) supaya warna moda yang sama tidak divergen antar layar.
import { Ionicons } from "@expo/vector-icons";
import { MODE_COLOR } from "./transitMode";

export type LegModeKey =
  | "walk"
  | "brt"
  | "feeder"
  | "jaklingko"
  | "krl"
  | "mrt"
  | "lrt"
  | "other";

// Kategori resmi `route_desc` feed GTFS TransJakarta (diteruskan backend
// sebagai `route_category` di leg BUS) -> sub-moda tampilan. Pengelompokan
// ini baseline dari task Label Antarmoda; kategori selain BRT dan
// Mikrotrans digabung ke "feeder" sampai ada keputusan lain.
export const TJ_CATEGORY_TO_MODE: Record<string, LegModeKey> = {
  BRT: "brt",
  Mikrotrans: "jaklingko",
  "Angkutan Umum Integrasi": "feeder",
  Transjabodetabek: "feeder",
  Rusun: "feeder",
  Royaltrans: "feeder",
  "Bus Wisata": "feeder",
};

export interface LegModeStyle {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  // Rel: garis peta navigasi ditarik lurus antar stasiun, bukan lewat
  // router jalan raya (OSRM) seperti bus.
  isRail: boolean;
}

export const LEG_MODES: Record<LegModeKey, LegModeStyle> = {
  walk: { label: "Walk", icon: "walk", color: "#A1A1AA", isRail: false },
  brt: { label: "TransJakarta", icon: "bus", color: MODE_COLOR.transjakarta, isRail: false },
  feeder: { label: "TransJakarta Feeder", icon: "bus-outline", color: "#0891B2", isRail: false },
  jaklingko: { label: "JakLingko", icon: "car", color: MODE_COLOR.jaklingko, isRail: false },
  krl: { label: "KRL", icon: "train", color: "#16A34A", isRail: true },
  mrt: { label: "MRT", icon: "subway", color: MODE_COLOR.mrt, isRail: true },
  lrt: { label: "LRT", icon: "train-outline", color: MODE_COLOR.lrt, isRail: true },
  other: { label: "Transit", icon: "navigate", color: "#FFFFFF", isRail: false },
};

// Chip filter moda di layar hasil rute (Task 5, diputuskan: 4 grup +
// "Semua"). Memilih chip MENCARI ULANG ke backend dengan moda terbatas —
// bukan menyaring kandidat yang sudah tampil. "Bus" = satu feed BUS, jadi
// TransJakarta, Feeder, dan JakLingko selalu ikut bersama.
export interface ModeFilter {
  key: string;
  label: string;
  // Mode transit OTP2 yang dikirim ke backend; undefined = semua moda.
  backendModes?: Array<"BUS" | "RAIL" | "SUBWAY" | "TRAM">;
  icon?: LegModeStyle["icon"];
}

export const MODE_FILTERS: ModeFilter[] = [
  // "Semua moda", bukan "Semua": baris chip kriteria di bawahnya sudah punya
  // chip "Semua" sendiri.
  { key: "all", label: "Semua moda" },
  { key: "bus", label: "Bus", backendModes: ["BUS"], icon: "bus" },
  { key: "krl", label: "KRL", backendModes: ["RAIL"], icon: "train" },
  { key: "mrt", label: "MRT", backendModes: ["SUBWAY"], icon: "subway" },
  { key: "lrt", label: "LRT", backendModes: ["TRAM"], icon: "train-outline" },
];

/** Mode OTP2 dari backend (+ kategori TransJakarta) -> sub-moda tampilan. */
export function legModeFromBackend(mode: string, routeCategory?: string): LegModeKey {
  switch (mode) {
    case "WALK":
      return "walk";
    case "RAIL":
      return "krl";
    case "SUBWAY":
      return "mrt";
    // OTP2 memetakan route_type 0 (light rail) ke TRAM; di graph ini satu-
    // satunya feed route_type 0 adalah LRT Jabodebek.
    case "TRAM":
      return "lrt";
    case "BUS":
      // Kategori tak dikenal/kosong tetap BRT-sebagai-default: satu-satunya
      // feed BUS adalah TransJakarta, dan label "TransJakarta" tidak salah
      // untuk rute mana pun di feed itu.
      return (routeCategory && TJ_CATEGORY_TO_MODE[routeCategory]) || "brt";
    default:
      return "other";
  }
}

const KEY_BY_LABEL = new Map<string, LegModeKey>(
  (Object.keys(LEG_MODES) as LegModeKey[]).map((k) => [LEG_MODES[k].label.toLowerCase(), k]),
);

/**
 * Komponen menerima leg.mode berupa label tampilan (lihat routeService.ts).
 * Label lama yang masih dipakai data mock ("Transjakarta", huruf kecil)
 * ikut dicocokkan tanpa peka huruf besar/kecil.
 */
export function legModeStyle(label: string): LegModeStyle {
  return LEG_MODES[KEY_BY_LABEL.get(label.toLowerCase()) ?? "other"];
}
