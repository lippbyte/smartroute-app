// Hari 2 Task 1: faktor emisi untuk estimasi CO₂ per kandidat rute.
// SATU-SATUNYA tempat faktor ini. Disetujui Khalifa (Task 0 Hari 2,
// 30 Okt 2026). Semua angka = ESTIMASI, gram CO₂e per penumpang-km.
//
// Mengganti nilai: naikkan FACTORS_VERSION supaya hasil lama & baru bisa
// dibedakan (ikut terkirim di setiap kandidat sebagai co2_factors_version).

export const FACTORS_VERSION = "2026-10-30.1";

export type TransitLegMode = "WALK" | "BUS" | "RAIL" | "SUBWAY" | "TRAM";

export interface FactorSource {
  key: string;
  label: string;
  g_per_pkm: number;
  source: string;
  url: string | null;
  year: string;
  occupancy: string;
  note: string;
  /** false = TODO:verifikasi (angka belum dicek ke sumber primer/metodologi). */
  verified: boolean;
}

// gram CO₂e per penumpang-km, per mode leg OTP2.
export const LEG_FACTORS: Record<TransitLegMode, FactorSource> = {
  WALK: {
    key: "WALK",
    label: "Jalan kaki",
    g_per_pkm: 0,
    source: "Tanpa emisi langsung (ditetapkan dokumen tugas Hari 2)",
    url: null,
    year: "—",
    occupancy: "—",
    note: "Emisi tidak langsung (makanan, dsb.) tidak dihitung.",
    verified: true,
  },
  SUBWAY: {
    key: "SUBWAY",
    label: "MRT Jakarta",
    g_per_pkm: 19,
    source:
      "Studi LCA transportasi publik Jakarta (tim Universitas Pertamina), jurnal Applied Sciences and Engineering Technology (ARASET): 0,019 kg CO₂/penumpang-km",
    url: "https://semarakilmu.com.my/journals/index.php/applied_sciences_eng_tech/article/view/1702",
    year: "Data masa COVID-19",
    occupancy: "Kapasitas dibatasi ±50% (protokol COVID-19)",
    note:
      "Satu studi akademik; konsumsi listrik dari logsheet PT MRT Jakarta. Teks lengkap belum diperiksa (TODO:verifikasi).",
    verified: false,
  },
  // LRT Jabodebek: proksi MRT (keputusan Khalifa) — sama-sama kereta
  // listrik pada jaringan listrik yang sama; angka 15 g dari kutipan berita
  // (Ametis Institute via RRI) tidak dipakai karena metodenya tidak jelas.
  TRAM: {
    key: "TRAM",
    label: "LRT Jabodebek",
    g_per_pkm: 19,
    source: "Proksi faktor MRT Jakarta (lihat MRT)",
    url: null,
    year: "—",
    occupancy: "Sama dengan MRT",
    note: "Belum ada sumber kuat khusus LRT Jabodebek (TODO:verifikasi).",
    verified: false,
  },
  // KRL: batas atas klaim KAI Commuter, supaya penghematan tidak dilebih-
  // lebihkan.
  RAIL: {
    key: "RAIL",
    label: "KRL Commuter Line",
    g_per_pkm: 41,
    source: "Klaim KAI Commuter 19–41 g CO₂/penumpang-km (dikutip IDXChannel); dipakai batas atas",
    url: "https://www.idxchannel.com/economics/pengguna-krl-jabodetabek-tembus-34931-juta-pada-2025/all",
    year: "Tidak disebut",
    occupancy: "Tidak disebut",
    note: "Angka perusahaan, metodologi tidak dipublikasikan (TODO:verifikasi).",
    verified: false,
  },
  // Semua leg BUS di feed TransJakarta (BRT, feeder, JakLingko/Mikrotrans).
  BUS: {
    key: "BUS",
    label: "Bus TransJakarta",
    g_per_pkm: 36,
    source: "Studi LCA yang sama dengan MRT (ARASET): BRT 0,036 kg CO₂/penumpang-km",
    url: "https://semarakilmu.com.my/journals/index.php/applied_sciences_eng_tech/article/view/1702",
    year: "Data masa COVID-19",
    occupancy: "Kapasitas dibatasi ±50% (protokol COVID-19)",
    note:
      "Komposisi armada (diesel/CNG/listrik) tidak dibedakan. JakLingko/Mikrotrans (armada kecil) memakai angka yang sama dan kemungkinan lebih tinggi per penumpang (TODO:verifikasi).",
    verified: false,
  },
};

// Pembanding: kendaraan pribadi menempuh jarak PROKSI yang sama (jumlah
// jarak semua leg rute, termasuk jalan kaki — keputusan Khalifa).
export const COMPARATORS: Record<"car" | "motorcycle", FactorSource> = {
  car: {
    key: "car",
    label: "Mobil sendirian",
    g_per_pkm: 170,
    source: "UK DESNZ, Greenhouse gas reporting conversion factors 2022, via Our World in Data (Petrol car 170,48 g/km)",
    url: "https://ourworldindata.org/grapher/carbon-footprint-travel-mode",
    year: "2022",
    occupancy: "1 orang per mobil (faktor DESNZ per kendaraan-km)",
    note: "Data Inggris; faktor bahan bakar berlaku umum, armada Jakarta bisa berbeda. Asumsi okupansi tidak ditulis eksplisit oleh OWID (TODO:verifikasi).",
    verified: false,
  },
  // 100, bukan 114 (UK): motor Indonesia (110–150 cc) lebih kecil dari
  // rata-rata Inggris; 100 = pembanding konservatif (keputusan Khalifa),
  // di dalam rentang 90–110 g yang dikutip KAI Commuter.
  motorcycle: {
    key: "motorcycle",
    label: "Motor",
    g_per_pkm: 100,
    source:
      "Nilai konservatif yang ditetapkan tim: UK DESNZ 2022 via OWID mencatat 113,55 g/km (motor Inggris rata-rata lebih besar); KAI Commuter mengutip 90–110 g",
    url: "https://ourworldindata.org/grapher/carbon-footprint-travel-mode",
    year: "2022",
    occupancy: "1 pengendara",
    note: "Belum ada sumber khusus motor Indonesia (TODO:verifikasi).",
    verified: false,
  },
};

/** Hasil estimasi satu kandidat; null bila ada leg tanpa jarak (tidak
 *  ditebak). Semua nilai dibulatkan ke puluhan gram. */
export interface Co2Estimate {
  co2_estimate_g: number;
  co2_by_mode: Partial<Record<TransitLegMode, number>>;
  co2_car_g: number;
  co2_motorcycle_g: number;
  /** Jarak proksi pembanding = jumlah jarak semua leg (m). */
  co2_comparator_distance_m: number;
  co2_basis: "estimasi";
  co2_factors_version: string;
}

const round10 = (g: number) => Math.round(g / 10) * 10;

export function estimateCo2(legs: Array<{ mode: TransitLegMode; distance_m?: number }>): Co2Estimate | null {
  if (legs.length === 0 || legs.some((l) => l.distance_m == null || !(l.mode in LEG_FACTORS))) return null;

  const rawByMode: Partial<Record<TransitLegMode, number>> = {};
  let rawTotal = 0;
  let distanceM = 0;
  for (const l of legs) {
    const g = (l.distance_m! / 1000) * LEG_FACTORS[l.mode].g_per_pkm;
    rawByMode[l.mode] = (rawByMode[l.mode] ?? 0) + g;
    rawTotal += g;
    distanceM += l.distance_m!;
  }

  const byMode: Partial<Record<TransitLegMode, number>> = {};
  for (const [mode, g] of Object.entries(rawByMode) as Array<[TransitLegMode, number]>) byMode[mode] = round10(g);

  return {
    // Total dari nilai mentah lalu dibulatkan (bukan jumlah rincian yang
    // sudah dibulatkan), jadi bisa beda ±10 g dari penjumlahan rincian.
    co2_estimate_g: round10(rawTotal),
    co2_by_mode: byMode,
    co2_car_g: round10((distanceM / 1000) * COMPARATORS.car.g_per_pkm),
    co2_motorcycle_g: round10((distanceM / 1000) * COMPARATORS.motorcycle.g_per_pkm),
    co2_comparator_distance_m: distanceM,
    co2_basis: "estimasi",
    co2_factors_version: FACTORS_VERSION,
  };
}
