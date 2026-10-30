// src/services/airQualityService.ts
//
// Hari 2 Task 3: kualitas udara Jakarta dari GET /air-quality (publik, tanpa
// token). Backend sudah meng-cache 15 menit dan tidak pernah 500; kegagalan
// jaringan di sini -> null (kartu udara & lencana "Sehat" tidak tampil,
// tanpa galat ke pengguna).
import { apiRequest } from "./apiClient";

export type AqiCategoryKey = "baik" | "sedang" | "sensitif" | "tidak_sehat" | "sangat_tidak_sehat" | "berbahaya";

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
}

type AirQualityResponse = AirQuality | { available: false; source: "IQAir"; reason: string };

export async function fetchAirQuality(): Promise<AirQuality | null> {
  try {
    const res = await apiRequest<AirQualityResponse>("GET", "/air-quality", {
      timeoutMs: 8_000,
      timeoutMessage: "Memuat kualitas udara terlalu lama.",
    });
    return res.available ? res : null;
  } catch {
    return null;
  }
}

/** Saran satu kalimat per kategori — informasi umum, BUKAN saran medis. */
export const AQI_ADVICE: Record<AqiCategoryKey, string> = {
  baik: "Udara cukup baik untuk berjalan kaki.",
  sedang: "Udara umumnya cukup baik; orang yang sangat sensitif bisa membatasi aktivitas berat di luar.",
  sensitif: "Kelompok sensitif sebaiknya mengurangi waktu di luar ruangan.",
  tidak_sehat: "Pertimbangkan rute dengan jalan kaki lebih sedikit.",
  sangat_tidak_sehat: "Kurangi waktu di luar ruangan bila memungkinkan.",
  berbahaya: "Hindari aktivitas di luar ruangan bila memungkinkan.",
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
