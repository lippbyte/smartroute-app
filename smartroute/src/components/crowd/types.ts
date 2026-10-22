// src/components/crowd/types.ts
//
// Task App-03: kontrak props yang sama untuk kedua implementasi peta
// kepadatan (web & native). Ditaruh di file terpisah supaya kedua file
// platform mengimpor definisi yang sama persis — bukan dua salinan yang bisa
// diam-diam berbeda.
import { CrowdOverviewStop } from "@/services/crowdService";

export interface CrowdMapViewProps {
  /**
   * Halte-halte yang punya laporan kepadatan aktif. Pemanggil (layar
   * crowd-map.tsx) sudah menangani state loading/error/kosong, jadi di sini
   * daftar ini selalu berisi minimal satu item.
   */
  stops: CrowdOverviewStop[];
  /**
   * Task App-07: dipanggil saat user memilih "Lapor di sini" dari marker
   * yang sudah tampil di peta (jalur cepat — beda dari alur cari-halte-dulu
   * yang dipicu tombol lapor terpisah di layar). Opsional supaya kedua
   * implementasi platform tidak wajib punya UI untuk ini kalau suatu saat
   * tidak relevan.
   */
  onReportStop?: (stop: CrowdOverviewStop) => void;
}
