// src/components/transit/transitMode.ts
//
// Task App-15: skema label/warna/ikon per moda transit, dipakai oleh layar
// "Halte Terdekat" (nearby-stops.tsx) untuk badge tiap item. Sama pola dengan
// crowdLevel.ts (LEVEL_LABEL/LEVEL_COLOR) — satu sumber kebenaran supaya
// warna & label tidak divergen kalau dipakai di lebih dari satu tempat nanti.
//
// Empat moda ini persis TransitMode di backend/backend-skeleton/src/services/
// nearbyStops.ts (Task Backend-11) — dua sumber data terpisah (proyek
// frontend & backend tidak satu workspace), jadi tipe ini sengaja disalin
// tangan, sama seperti CrowdOverviewStop di crowdService.ts.
import { Ionicons } from "@expo/vector-icons";

export type TransitMode = "transjakarta" | "jaklingko" | "mrt" | "lrt";

export const MODE_LABEL: Record<TransitMode, string> = {
  transjakarta: "TransJakarta",
  jaklingko: "JakLingko",
  mrt: "MRT",
  lrt: "LRT",
};

// Warna dipilih beda-beda per moda supaya sekilas ("scan cepat") langsung
// bisa dibedakan tanpa baca label — bukan warna resmi masing-masing
// operator (tidak ada satu sumber resmi yang konsisten untuk keempatnya),
// murni untuk keterbacaan UI.
export const MODE_COLOR: Record<TransitMode, string> = {
  transjakarta: "#2563EB",
  jaklingko: "#F97316",
  mrt: "#DC2626",
  lrt: "#7C3AED",
};

export const MODE_ICON: Record<TransitMode, keyof typeof Ionicons.glyphMap> = {
  transjakarta: "bus",
  jaklingko: "car",
  mrt: "train",
  lrt: "train",
};

// Perluasan App-15 (peta semua halte, diminta user langsung): titik di peta
// (AllStopsMapView) tidak bisa pakai <Ionicons> — MapLibre native cuma bisa
// nge-render lingkaran polos (CircleLayer) atau gambar raster (perlu aset
// PNG, belum ada infrastrukturnya di proyek ini) di dalam style layer,
// BUKAN font-icon React seperti Ionicons. Kode huruf pendek ini dipakai
// sebagai label di dalam lingkaran warna sebagai pengganti — beda sekilas
// pandang tanpa baca warna dulu, jalan sama persis di native (SymbolLayer
// text-field) & web (L.divIcon), tidak butuh aset gambar tambahan.
export const MODE_SHORT_LABEL: Record<TransitMode, string> = {
  transjakarta: "TJ",
  jaklingko: "JL",
  mrt: "M",
  lrt: "L",
};

/**
 * "350m" kalau di bawah 1km, "1.2km" kalau di atas — ambang & format sama
 * seperti yang dipakai aplikasi peta pada umumnya (Google Maps dkk), sesuai
 * contoh di task ("misal 350m").
 */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}
