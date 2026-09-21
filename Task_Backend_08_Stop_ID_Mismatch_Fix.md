# Task Backend-08: Perbaiki Ketidakcocokan ID Halte (Crowd Reports vs OTP2 Routing)

**Assignee:** Lippable
**Prioritas: KRITIS — tanpa ini, "momen utama" demo (Skenario 2) tidak mungkin berhasil, dengan atau tanpa UI.**

## Tujuan

Satukan skema ID halte yang dipakai fitur crowd-report/Peta Kepadatan dengan skema ID yang dipakai OTP2 secara internal untuk routing — supaya laporan yang disubmit lewat ID yang natural didapat user (dari daftar halte di Peta Kepadatan) benar-benar match dengan halte yang dipakai OTP2 saat menghitung rute.

## Konteks

Rehearsal menemukan: daftar halte di Task Backend-07 (buat Peta Kepadatan) memakai ID mentah dari `stops.txt` GTFS (contoh: `H00219S`), sementara OTP2 secara internal mengidentifikasi halte fisik yang sama pakai gtfsId berbeda (`1:G00080`) — dan ID inilah yang sudah dipakai **benar** oleh `routing.ts` (Task Backend-04) saat mencocokkan `crowd_level` ke rute. Submit laporan pakai `H00219S` diam-diam tidak match apa pun di rute manapun; baru match kalau disubmit pakai `1:G00080` — ID yang mustahil diketahui/didapat user biasa dari dalam app.

Mekanisme pencocokan `routing.ts` sendiri **sudah terbukti benar** (skor berubah 0.515→0.34 begitu ID yang tepat dipakai) — yang salah adalah sumber ID yang dipakai fitur Peta Kepadatan, bukan logic pencocokannya.

## Lingkup

- Ganti sumber data Task Backend-07 (list halte untuk Peta Kepadatan) dari parsing `stops.txt` mentah, menjadi query GraphQL langsung ke OTP2 (query `stops` yang sudah tersedia di OTP2, mengembalikan `gtfsId`, `name`, `lat`, `lon`) — supaya ID yang ditampilkan/dipakai di app selalu konsisten dengan ID yang dipakai OTP2 untuk routing, bukan dua sumber kebenaran yang terpisah.
- `stop_id` di response `GET /crowd-reports` (list) dan di request `POST /crowd-reports` harus konsisten memakai skema gtfsId OTP2 ini.
- Regression check: pastikan logic pencocokan yang sudah ada di `routing.ts` (Task Backend-04) tetap berfungsi benar setelah perubahan sumber ID ini — logic-nya sendiri tidak perlu diubah, cuma sumber data list-nya yang diseragamkan.

## Batasan eksplisit

- **Jangan bikin tabel/fungsi mapping manual antara dua skema ID** — itu solusi rapuh, persis kelas bug yang baru saja ditemukan (dua sumber kebenaran yang bisa diam-diam berbeda). Solusinya adalah pakai **satu sumber kebenaran** (OTP2) untuk kedua fitur, bukan menjembatani dua skema berbeda.
- Jangan ubah skema `RouteCandidate` atau response `/routes` — perubahan ini murni di level bagaimana Task Backend-07 mengambil daftar halte.

## Acceptance criteria

- `GET /crowd-reports` (list) mengembalikan `stop_id` dalam skema gtfsId yang sama persis dengan yang dipakai OTP2 secara internal.
- Submit laporan memakai `stop_id` yang didapat langsung dari hasil `GET /crowd-reports` (list) itu sendiri — ulangi skenario Kalideres→PGC: search rute, submit laporan ke titik transfer pakai ID dari list, cari ulang, skor berubah dan `crowd_level` muncul — **tanpa perlu query GraphQL manual terpisah untuk mencari ID yang "benar"**, seperti yang terpaksa dilakukan saat rehearsal kemarin.
- Regresi: fitur `crowd_level` yang sudah ada di `/routes` (Task Backend-04) tetap berfungsi seperti sebelumnya untuk skenario yang sudah pernah diverifikasi.
