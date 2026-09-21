# Task App-19: Verifikasi Trimming Rute Real-time saat Navigasi

**Assignee:** Lippable

## Tujuan

Pastikan garis rute di layar Navigasi benar-benar memendek/ter-update seiring user berjalan mendekati tujuan — seperti pengalaman di Google Maps — bukan garis statis yang diam sejak awal.

## Konteks

Ditemukan referensi ke fungsi "jarak-relatif untuk trimming polyline" di `navigate.tsx` (disebut di laporan Task App-13), tapi belum pernah eksplisit diverifikasi apakah ini benar-benar bekerja saat user bergerak, atau cuma dihitung sekali di awal dan tidak pernah diperbarui.

## Lingkup

- Cek kode `navigate.tsx`: apakah polyline rute di-render ulang/dipotong setiap kali `userLocation` (dari `watchPositionAsync`) berubah, atau cuma dihitung sekali saat layar dibuka?
- Kalau belum benar-benar live: perbaiki supaya garis rute terpotong secara progresif sesuai posisi GPS terbaru user, bukan statis.
- Laporkan temuan dengan jelas — jangan asumsikan "kemungkinan sudah benar" tanpa video/screenshot bukti sebelum dan sesudah user bergerak.

## Batasan eksplisit

- Karena GPS asli sulit disimulasikan bergerak beneran, kalau perlu, gunakan mock location bertahap (beberapa titik berurutan mendekati tujuan) untuk verifikasi otomatis — tapi tetap laporkan bahwa ini hasil simulasi, bukan gerakan fisik asli.

## Acceptance criteria

- Laporan jelas: apakah rute sudah live-trim sebelumnya atau tidak, dengan bukti (screenshot sebelum/sesudah beberapa titik GPS berbeda).
- Kalau diperbaiki: garis rute terpotong sesuai posisi terbaru user, diverifikasi dengan minimal 3 titik GPS berurutan mendekati tujuan.
- Anda diminta verifikasi tambahan secara fisik (jalan kaki beneran membawa HP) untuk konfirmasi akhir sebelum dianggap selesai.
