# Task Backend-03b: Native Lat/Lng Routing + Perbaikan Tarif

**Assignee:** Lippable
**Prasyarat:** Task Backend-02b selesai (graf OTP2 sudah punya data OSM), Task Backend-03 selesai (`otpClient.ts`, `routing.ts`, `/routes` sudah ada sebagai baseline).

## Tujuan

Dua perbaikan dalam satu task karena saling terkait di file yang sama:
1. Ganti workaround manual (snap ke halte terdekat via `stopsByRadius` + walk leg sintetis) dengan query native OTP2 yang sekarang bisa menerima lat/lng asal-tujuan langsung — karena graf sudah punya OSM, OTP2 menghitung access/egress walk leg sendiri, mengikuti jalan asli.
2. Perbaiki `cost_idr` jadi tarif flat Rp 3.500 per itinerary (bukan dikalikan jumlah transfer) — sesuai kebijakan transit gratis 3 jam TransJakarta.

## Lingkup

- Update `otpClient.ts`: tambah/ubah method query `planConnection` agar menerima origin/destination sebagai lat/lng langsung, bukan stop ID hasil snapping manual.
- Update `routing.ts`:
  - Hapus logic `findNearestStop` + perhitungan walk leg sintetis untuk access/egress (bagian awal & akhir perjalanan) — gantikan dengan walk leg yang dikembalikan OTP2 secara native.
  - **Pertahankan** logic dedupe-by-route-pattern dari Task Backend-03 — itu perbaikan independen yang masih relevan, tidak terkait masalah OSM.
  - Ganti perhitungan `cost_idr`: flat Rp 3.500 per itinerary, berapa pun `transfer_count`-nya.
- Re-verifikasi 3 rute AC dari Task Backend-03 (Blok M–Kota, Kalideres–PGC, Grogol–Kampung Melayu) dengan kode yang sudah diperbarui — catat di README/komentar kalau ada angka yang berubah dari hasil sebelumnya (waktu tempuh, jarak jalan kaki, jumlah alternatif rute), dan simpan sebagai angka referensi baru.

## Batasan eksplisit

- Jangan ubah skema `RouteRecommendation`/`RouteCandidate` dari Task Backend-01 — transformasi tetap harus menghasilkan skema yang sama persis, cuma cara menghitungnya yang berubah secara internal.
- Jangan tambah endpoint baru — ini murni perbaikan internal pada `/routes` yang sudah ada.
- Jangan sentuh `crowd_level`/`reliability` — tetap `undefined`, itu task terpisah nanti (Backend-04/05).

## Acceptance criteria

- 3 rute AC sebelumnya tetap menghasilkan response valid sesuai skema, dengan `walking_distance_m` sekarang berasal dari perhitungan native OTP2 (bukan fallback lama) — verifikasi lewat log/response bahwa jalur native yang benar-benar terpakai, bukan diam-diam masih pakai kode lama.
- `cost_idr` selalu Rp 3.500 pada setiap hasil, termasuk untuk rute dengan 2 transfer (Kalideres–PGC) — pastikan ada test case yang eksplisit mengecek ini.
- Semua error path dari Task Backend-03 (400 input salah, 422 titik tidak terjangkau, 502 OTP2 tidak bisa dihubungi, 500 output gagal validasi skema) tetap berfungsi setelah refactor — ini regresi yang harus dicek ulang satu per satu, bukan diasumsikan otomatis masih jalan.
- `tsc --noEmit` tetap lolos tanpa error.
