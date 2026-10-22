// src/components/transit/allStopsMapTypes.ts
//
// Kontrak props sama untuk kedua implementasi platform AllStopsMapView (web
// & native) — pola sama persis dengan crowd/types.ts (Task App-03).
import { TransitStop } from "@/services/nearbyStopsService";
import { Coordinate } from "@/utils/geocode";

export interface AllStopsMapViewProps {
  /**
   * Semua halte yang mau ditampilkan (sudah difilter moda oleh pemanggil
   * kalau user mematikan salah satu toggle). Bisa ribuan item — kedua
   * implementasi WAJIB nge-cluster, bukan render marker satu-satu.
   */
  stops: TransitStop[];
  /**
   * Tinggi (px) area kontrol milik LAYAR yang menumpuk di bagian bawah peta
   * (baris chip filter moda di all-stops-map.tsx). Kartu info halte yang
   * muncul saat titik di-tap diposisikan di ATAS area ini supaya tidak
   * saling menimpa — diukur dinamis lewat onLayout oleh pemanggil, bukan
   * angka tebakan, karena jumlah baris chip berubah-ubah tergantung lebar
   * layar (4 chip bisa jadi 1 atau 2 baris).
   */
  bottomInset?: number;
  /** Posisi GPS user; null kalau izin ditolak / belum terbaca. */
  userLocation?: Coordinate | null;
}

/**
 * Dipakai fitur cari-nama-halte: pemanggil (all-stops-map.tsx) minta peta
 * pindah ke satu titik saat user tap salah satu hasil pencarian. Pola sama
 * dengan NavigateMapHandle/flyTo (navigate/NavigateMap.native.tsx &
 * .web.tsx) — imperative handle karena "pindah kamera" bukan sesuatu yang
 * bisa dinyatakan lewat props biasa (tidak ada state React yang representasi
 * "kamera lagi di titik X" secara terus-menerus, cuma one-shot action).
 */
export interface AllStopsMapViewHandle {
  flyTo: (coordinate: { lat: number; lng: number }, zoom?: number) => void;
}
