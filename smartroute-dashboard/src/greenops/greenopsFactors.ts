// DRAF, BELUM DISETUJUI
// Task 1: faktor energi & emisi per kendaraan-km. Satu-satunya tempat angka ini.
// Rincian, cara hitung, dan perbandingan: task/Dashboard_GreenOps_Tabel_Faktor.md.
//
// STATUS: DRAF. Dokumen tugas mensyaratkan persetujuan Khalifa sebelum angka
// tampil di dashboard. Selama FACTORS_APPROVED false, UI menampilkan penanda draf.
//
// Aturan: angka tanpa sumber = status "tidak_tersedia" dan energy null. Moda itu
// tidak ikut dihitung. Jangan mengisi perkiraan buatan.
import type { ModeKey } from "../simulation/types.ts";

export const FACTORS_VERSION = "greenops-2026-11-03.draf";
export const FACTORS_APPROVED = false;

export type FactorModeKey = ModeKey | "lrt_jakarta" | "whoosh";
export type Strength = "kuat" | "sedang" | "lemah";
export type Carrier = "listrik" | "diesel";

export interface Source {
  title: string;
  url: string;
  year: string;
  /** Apa yang diambil dari sumber ini. */
  used: string;
  /** false bila alat otomatis ditolak situsnya (mis. 403) atau hanya abstrak yang terbaca. */
  openedFullText: boolean;
}

export interface Capacity {
  passengers: number;
  basis: string;
  source: Source;
}

export interface GreenopsFactor {
  mode: FactorModeKey;
  label: string;
  status: "tersedia" | "tidak_tersedia";
  /** Energi per kendaraan-km. null = tidak tersedia. */
  energy: { value: number; unit: "kWh/km" | "L/km"; carrier: Carrier } | null;
  capacity: Capacity | null;
  sources: Source[];
  year: string;
  scope: "Indonesia" | "Luar negeri" | "Tidak ada";
  assumptions: string;
  strength: Strength | null;
  todoVerify: boolean;
  /** Alasan bila status tidak_tersedia. */
  unavailableReason?: string;
  /** Moda ada di data jaringan simulasi? */
  inNetwork: boolean;
}

// ---------- Faktor bahan bakar dan listrik ----------

const GEC_JCM: Source = {
  title: "GEC, Daftar faktor emisi listrik program JCM (Reiwa 4), lampiran 2 Indonesia, baris 22 Jamali",
  url: "https://gec.jp/innovation/R4/T.CO2EmissionFactor_20220406.pdf",
  year: "2022",
  used: "Jamali 0,87 tCO₂/MWh",
  openedFullText: true,
};

/**
 * Jaringan Jawa-Madura-Bali, gCO₂/kWh. Berasal dari tabel JCM yang dipakai untuk
 * penilaian proyek, bukan rata-rata jaringan: situs lain mencatat rata-rata
 * Indonesia lebih rendah (sekitar 625-680 g/kWh), jadi hasil rel cenderung atas.
 * Dokumen primer Ditjen Ketenagalistrikan belum berhasil dibuka (TODO:verifikasi).
 */
export const GRID_G_PER_KWH = 870;

const ICCT_2024: Source = {
  title:
    "ICCT, Planning the adoption of battery electric buses in Transjakarta: Route-level energy consumption, driving range, and total cost of ownership (Working Paper, Feb 2024)",
  url: "https://theicct.org/wp-content/uploads/2024/01/ID-44-%E2%80%93-Transjakarta-TCO-Working-Paper-A4-50108-PUBLIC-fv-1.pdf",
  year: "2024",
  used: "Bus diesel 12 m rute 1, 13, 2A, 5: 4,5; 4,49; 4,94; 4,6 kWh/km (h.14); 1 DLE B20 = 9,69 kWh (h.13); kapasitas 24 duduk + 26 berdiri (h.21)",
  openedFullText: true,
};

const IPCC_2006: Source = {
  title: "2006 IPCC Guidelines, Vol. 2 Ch. 3 Mobile Combustion, Table 3.2.1",
  url: "https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_3_Ch3_Mobile_Combustion.pdf",
  year: "2006",
  used: "Gas/Diesel Oil 74.100 kg CO₂/TJ",
  openedFullText: true,
};

/** Isi energi satu liter setara diesel B20, kWh (ICCT 2024 h.13). */
export const DIESEL_KWH_PER_LITER = 9.69;
/** Faktor CO₂ diesel, gram per megajoule (IPCC: 74.100 kg/TJ). */
export const DIESEL_G_PER_MJ = 74.1;
/** gCO₂ per liter = 74,1 g/MJ × 9,69 kWh/L × 3,6 MJ/kWh. */
export const DIESEL_G_PER_LITER = DIESEL_G_PER_MJ * DIESEL_KWH_PER_LITER * 3.6;

/** Rata-rata empat rute ICCT, kWh/km, dibagi 9,69 kWh/L. */
export const BUS_12M_LITER_PER_KM = (4.5 + 4.49 + 4.94 + 4.6) / 4 / DIESEL_KWH_PER_LITER;

// ---------- MRT: diturunkan, bukan dikutip langsung ----------

const LISTRIK_ID_2023: Source = {
  title: "Listrik Indonesia, Efisiensi Energi, Cara MRT Jakarta Dukung Zero Emisi (21 Jul 2023)",
  url: "https://listrikindonesia.com/detail/11359/efisiensi-energi-cara-mrt-jakarta-dukung-zero-emisi",
  year: "2022",
  used: "“10 persen (5.000 MWh) penggunaan listrik MRT Jakarta” → total ±50.000 MWh per tahun",
  openedFullText: true,
};

/** Listrik seluruh sistem MRT 2022, kWh per tahun (5.000 MWh ÷ 10%). */
export const MRT_SYSTEM_KWH_PER_YEAR = 50_000_000;
/** Km-kereta per tahun dari GTFS kita: 27.192 km/minggu × 365,25/7. Lihat tests. */
export const MRT_TRAIN_KM_PER_YEAR = 1_418_853;

// ---------- Kapasitas ----------

const CNN_2021: Source = {
  title: "CNN Indonesia, Beda Transportasi Rel Ibu Kota: LRT, MRT dan KRL (26 Okt 2021)",
  url: "https://www.cnnindonesia.com/ekonomi/20211026164418-92-712642/beda-transportasi-rel-ibu-kota-lrt-mrt-dan-krl",
  year: "2021",
  used: "MRT 1.950 dan KRL 2.000 penumpang sekali jalan",
  openedFullText: true,
};
const FORTUNE_2023: Source = {
  title: "Fortune IDN, Beroperasi Akhir Agustus, Begini Cara Naik LRT Jabodebek (25 Agu 2023)",
  url: "https://www.fortuneidn.com/news/beroperasi-akhir-agustus-begini-cara-naik-lrt-jabodebek-00-my5jv-c3ygsd",
  year: "2023",
  used: "6 kereta, hingga 1.308 penumpang per rangkaian",
  openedFullText: true,
};
const DETIK_2023: Source = {
  title: "detikFinance, LRT Jakarta Diklaim Nggak Sepi Penumpang, Begini Datanya (16 Des 2023)",
  url: "https://finance.detik.com/infrastruktur/d-7093019/lrt-jakarta-diklaim-nggak-sepi-penumpang-begini-datanya",
  year: "2023",
  used: "2 kereta, hingga 270 penumpang per rangkaian",
  openedFullText: true,
};
const UGM_2015: Source = {
  title: "Arfian Angga Yulanto, Analisis Outage Cost pada Operasi KRL PT KAI Commuter Jabodetabek (skripsi UGM, 2015)",
  url: "https://etd.repository.ugm.ac.id/penelitian/detail/93343",
  year: "2015",
  used: "“tiap KRL mengonsumsi energi sebesar 17,856 kWh/km” (abstrak)",
  openedFullText: false,
};

const BUS_NOTE =
  "Bus diesel 12 m Euro III hasil simulasi ICCT, AC menyala. CO₂ knalpot saja: CH₄ dan N₂O tidak dihitung, porsi biodiesel tidak dikurangkan (cenderung atas). Armada campuran (CNG, listrik, gandeng 18 m) tidak dibedakan.";

export const FACTORS: Record<FactorModeKey, GreenopsFactor> = {
  mrt: {
    mode: "mrt",
    label: "MRT Jakarta",
    status: "tersedia",
    energy: { value: MRT_SYSTEM_KWH_PER_YEAR / MRT_TRAIN_KM_PER_YEAR, unit: "kWh/km", carrier: "listrik" },
    capacity: { passengers: 1950, basis: "6 kereta, sekali jalan", source: CNN_2021 },
    sources: [LISTRIK_ID_2023, GEC_JCM],
    year: "2022",
    scope: "Indonesia",
    assumptions:
      "Diturunkan: listrik SELURUH sistem (termasuk stasiun dan depo) dibagi km-kereta jadwal GTFS 2026. Listrik 2022 dan jadwal 2026 berbeda tahun. Cenderung atas untuk per kereta.",
    strength: "lemah",
    todoVerify: true,
    inNetwork: true,
  },
  lrt_jakarta: {
    mode: "lrt_jakarta",
    label: "LRT Jakarta",
    status: "tidak_tersedia",
    energy: null,
    capacity: { passengers: 270, basis: "2 kereta, duduk dan berdiri", source: DETIK_2023 },
    sources: [DETIK_2023],
    year: "—",
    scope: "Tidak ada",
    assumptions: "—",
    strength: null,
    todoVerify: true,
    unavailableReason:
      "Belum ada sumber kWh per km-kereta. Satu makalah hanya memodelkan traksi, tanpa beban lain. Moda ini juga belum ada di GTFS kita.",
    inNetwork: false,
  },
  lrt_jabodebek: {
    mode: "lrt_jabodebek",
    label: "LRT Jabodebek",
    status: "tidak_tersedia",
    energy: null,
    capacity: { passengers: 1308, basis: "6 kereta, kapasitas padat", source: FORTUNE_2023 },
    sources: [FORTUNE_2023],
    year: "—",
    scope: "Tidak ada",
    assumptions: "—",
    strength: null,
    todoVerify: true,
    unavailableReason:
      "Belum ada sumber kWh per km-kereta. Proksi MRT pada faktor per penumpang-km tidak diteruskan ke sini: ukuran dan berat keretanya berbeda.",
    inNetwork: true,
  },
  krl: {
    mode: "krl",
    label: "KRL Commuter Line",
    status: "tersedia",
    energy: { value: 17.856, unit: "kWh/km", carrier: "listrik" },
    capacity: { passengers: 2000, basis: "8-10 kereta, sekali jalan", source: CNN_2021 },
    sources: [UGM_2015, GEC_JCM],
    year: "2015",
    scope: "Indonesia",
    assumptions:
      "Satu skripsi; hanya abstrak yang terbaca. Abstrak menyebut “tiap KRL”, tidak jelas per rangkaian atau traksi saja. Rangkaian 12 kereta tidak dibedakan.",
    strength: "lemah",
    todoVerify: true,
    inNetwork: true,
  },
  whoosh: {
    mode: "whoosh",
    label: "Whoosh",
    status: "tidak_tersedia",
    energy: null,
    capacity: null,
    sources: [],
    year: "—",
    scope: "Tidak ada",
    assumptions: "—",
    strength: null,
    todoVerify: false,
    unavailableReason: "Tidak ada sumber layak dan tidak ada di data jaringan kita. Tidak dihitung.",
    inNetwork: false,
  },
  brt: {
    mode: "brt",
    label: "BRT TransJakarta",
    status: "tersedia",
    energy: { value: BUS_12M_LITER_PER_KM, unit: "L/km", carrier: "diesel" },
    capacity: { passengers: 50, basis: "Bus 12 m: 24 duduk + 26 berdiri", source: ICCT_2024 },
    sources: [ICCT_2024, IPCC_2006],
    year: "2024",
    scope: "Indonesia",
    assumptions: BUS_NOTE,
    strength: "sedang",
    todoVerify: true,
    inNetwork: true,
  },
  bus: {
    mode: "bus",
    label: "Bus besar non-BRT",
    status: "tersedia",
    energy: { value: BUS_12M_LITER_PER_KM, unit: "L/km", carrier: "diesel" },
    capacity: { passengers: 50, basis: "Bus 12 m: 24 duduk + 26 berdiri", source: ICCT_2024 },
    sources: [ICCT_2024, IPCC_2006],
    year: "2024",
    scope: "Indonesia",
    assumptions: `Proksi BRT. Kategori GTFS ini (Angkutan Umum Integrasi, Transjabodetabek, Royaltrans, Rusun, Wisata) memuat juga bus lebih kecil dan pola berhenti berbeda. ${BUS_NOTE}`,
    strength: "lemah",
    todoVerify: true,
    inNetwork: true,
  },
  mikrotrans: {
    mode: "mikrotrans",
    label: "Mikrotrans",
    status: "tidak_tersedia",
    energy: null,
    capacity: null,
    sources: [],
    year: "—",
    scope: "Tidak ada",
    assumptions: "—",
    strength: null,
    todoVerify: true,
    unavailableReason: "Belum ada sumber konsumsi bahan bakar armada Mikrotrans. Tidak dihitung.",
    inNetwork: true,
  },
};

export const ALL_FACTOR_MODES = Object.keys(FACTORS) as FactorModeKey[];

/** gCO₂ per kendaraan-km = energi × faktor. null bila moda tidak punya faktor. */
export function gramsPerVehicleKm(mode: FactorModeKey): number | null {
  const f = FACTORS[mode];
  if (f.status !== "tersedia" || !f.energy) return null;
  return f.energy.value * (f.energy.carrier === "listrik" ? GRID_G_PER_KWH : DIESEL_G_PER_LITER);
}

/**
 * Faktor per penumpang-km yang sudah dipakai app mobile, disalin untuk
 * dibandingkan. Sumbernya backend/backend-skeleton/src/services/emissionFactors.ts;
 * tests/greenops.test.ts memastikan salinan ini tidak bergeser.
 */
export const EXISTING_G_PER_PKM: Partial<Record<FactorModeKey, number>> = {
  mrt: 19,
  lrt_jabodebek: 19,
  krl: 41,
  brt: 36,
  bus: 36,
  mikrotrans: 36,
};
export const CAR_G_PER_PKM = 170;
export const CAR_SOURCE =
  "Faktor 170 g/pkm yang sudah dipakai app: UK DESNZ 2022 via Our World in Data, mobil bensin, 1 orang per mobil. Data Inggris (TODO:verifikasi).";

/** Skenario okupansi: ASUMSI yang bisa diubah, porsi dari kapasitas nominal. */
export const OCCUPANCY_SCENARIOS = {
  rendah: 0.25,
  sedang: 0.5,
  tinggi: 0.75,
} as const;
export type OccupancyScenario = keyof typeof OCCUPANCY_SCENARIOS;
