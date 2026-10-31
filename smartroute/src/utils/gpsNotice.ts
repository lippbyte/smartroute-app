// src/utils/gpsNotice.ts
//
// Hari 4 Task 1: pesan di layar navigasi saat posisi GPS tidak bisa dipakai.
// Dulu izin ditolak didiamkan — peta tanpa titik posisi dan langkah tidak
// pernah pindah sendiri, tanpa penjelasan. Satu kalimat singkat, mengarahkan
// ke tombol langkah manual (ada di mode peta maupun mode sederhana).
// Fungsi murni, diuji di scripts/test-gps-notice.mts.

/** denied = izin ditolak; unavailable = izin ada tapi posisi gagal dibaca. */
export type GpsIssue = "denied" | "unavailable";

export function gpsIssueFromPermission(status: string): GpsIssue | null {
  return status === "granted" ? null : "denied";
}

export function gpsNotice(issue: GpsIssue | null): string | null {
  if (issue === "denied") return "Izin lokasi ditolak, jadi geser langkah dengan tombol di bawah.";
  if (issue === "unavailable") return "Lokasi tidak terbaca, jadi geser langkah dengan tombol di bawah.";
  return null;
}
