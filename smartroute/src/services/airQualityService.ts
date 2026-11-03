// src/services/airQualityService.ts
//
// Hari 2 Task 3: kualitas udara Jakarta dari GET /air-quality (publik, tanpa
// token). Backend sudah meng-cache 15 menit dan tidak pernah 500; kegagalan
// jaringan di sini -> null (kartu udara & lencana "Sehat" tidak tampil,
// tanpa galat ke pengguna).
import { t, type TKey } from "@/i18n";
import { apiRequest } from "./apiClient";

export type AqiCategoryKey = "baik" | "sedang" | "sensitif" | "tidak_sehat" | "sangat_tidak_sehat" | "berbahaya";

export interface AirWeather {
  temp_c: number | null;
  humidity_pct: number | null;
  wind_ms: number | null;
  wind_deg: number | null;
  pressure_hpa: number | null;
  observed_at: string | null;
}

export interface AirQuality {
  available: true;
  aqi_us: number;
  category: string;
  category_key: AqiCategoryKey;
  pollutant_main: string | null;
  observed_at: string | null;
  fetched_at: string;
  stale: boolean;
  source: "IQAir";
  city: string;
  weather?: AirWeather | null;
}

/** Halaman Jakarta di situs IQAir, untuk data yang lebih lengkap. */
export const IQAIR_CITY_URL = "https://www.iqair.com/indonesia/jakarta";

const aqiStep = (key: AqiCategoryKey, range: string, label: TKey) => ({
  key,
  range,
  get label() {
    return t(label);
  },
});

/** Skala AQI AS, sama dengan ambang kategori di backend (services/airQuality.ts). */
export const AQI_SCALE: ReadonlyArray<{ key: AqiCategoryKey; range: string; label: string }> = [
  aqiStep("baik", "0–50", "air.scale.baik"),
  aqiStep("sedang", "51–100", "air.scale.sedang"),
  aqiStep("sensitif", "101–150", "air.scale.sensitif"),
  aqiStep("tidak_sehat", "151–200", "air.scale.tidak_sehat"),
  aqiStep("sangat_tidak_sehat", "201–300", "air.scale.sangat_tidak_sehat"),
  aqiStep("berbahaya", "301+", "air.scale.berbahaya"),
];

/**
 * Nama kategori dalam bahasa aktif, dari kode category_key. Teks dari server hanya
 * cadangan bila kodenya tidak dikenal. Label Indonesia sama dengan label backend.
 */
export function aqiCategoryLabel(air: Pick<AirQuality, "category" | "category_key">): string {
  return AQI_SCALE.find((s) => s.key === air.category_key)?.label ?? air.category;
}

type AirQualityResponse = AirQuality | { available: false; source: "IQAir"; reason: string };

export async function fetchAirQuality(): Promise<AirQuality | null> {
  try {
    const res = await apiRequest<AirQualityResponse>("GET", "/air-quality", {
      timeoutMs: 8_000,
      timeoutMessage: t("air.timeout"),
    });
    return res.available ? res : null;
  } catch {
    return null;
  }
}

/** Saran satu kalimat per kategori — informasi umum, BUKAN saran medis. */
export const AQI_ADVICE: Record<AqiCategoryKey, string> = {
  get baik() {
    return t("air.advice.baik");
  },
  get sedang() {
    return t("air.advice.sedang");
  },
  get sensitif() {
    return t("air.advice.sensitif");
  },
  get tidak_sehat() {
    return t("air.advice.tidak_sehat");
  },
  get sangat_tidak_sehat() {
    return t("air.advice.sangat_tidak_sehat");
  },
  get berbahaya() {
    return t("air.advice.berbahaya");
  },
};

/** Warna latar chip kategori + teks gelap di atasnya (kontras AA). */
export const AQI_COLORS: Record<AqiCategoryKey, { bg: string; text: string }> = {
  baik: { bg: "#D1FAE5", text: "#065F46" },
  sedang: { bg: "#FEF3C7", text: "#78350F" },
  sensitif: { bg: "#FFEDD5", text: "#7C2D12" },
  tidak_sehat: { bg: "#FEE2E2", text: "#7F1D1D" },
  sangat_tidak_sehat: { bg: "#EDE9FE", text: "#4C1D95" },
  berbahaya: { bg: "#FCE7F3", text: "#831843" },
};
