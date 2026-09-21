# Task App-07: UI Submit Laporan Kepadatan

**Assignee:** Lippable
**Prasyarat:** Task Backend-08 selesai (skema ID sudah konsisten — kalau UI ini dibangun sebelum ID diperbaiki, harus ditulis ulang begitu skema ID berubah).

## Tujuan

Tambah cara submit laporan kepadatan lewat UI (bukan curl) — supaya "momen utama" Skenario 2 di runbook rehearsal benar-benar bisa didemokan dari dalam app.

## Lingkup

- Di layar Peta Kepadatan: tambah cara submit laporan baru — opsi paling sederhana, tap marker/halte yang muncul di peta atau di hasil pencarian, muncul dialog/bottom-sheet pilih level (Lengang/Cukup Padat/Padat), submit.
- Kalau halte yang mau dilaporkan belum muncul di peta (belum ada laporan aktif sebelumnya): sediakan cara cari/pilih halte dulu (reuse autocomplete dari App-06 kalau relevan, atau list halte sederhana).
- Setelah submit berhasil: refresh data peta, marker baru/ter-update langsung terlihat sebagai feedback visual.

## Bug tambahan yang WAJIB diperbaiki di task ini (bukan opsional)

Ditemukan saat verifikasi Backend-08: saat cuma ada **1 laporan aktif**, marker di Peta Kepadatan gagal render — `fitBounds` pada satu titik menghasilkan bounds berukuran nol. Ini bukan bug kosmetik yang bisa ditunda — **Skenario 2 dimulai dari peta kosong, lalu submit SATU laporan live**, yang persis kondisi ini. Kalau tidak diperbaiki, momen utama demo akan menampilkan peta kosong padahal laporan sudah berhasil terkirim, terlihat seperti fitur gagal padahal cuma bug rendering.

- Perbaiki logic `fitBounds`/zoom di `crowd-map.tsx`: kalau cuma ada 1 titik, set zoom level tetap yang wajar (bukan `fitBounds` yang butuh minimal 2 titik untuk menghitung area).

## Batasan eksplisit

- Jangan bangun ulang alur pencarian rute untuk ini — fitur ini berdiri sendiri di layar Peta Kepadatan.
- Jangan tambah sistem autentikasi/pembatasan siapa yang boleh lapor — tetap sesuai batasan awal Task Backend-04 (tanpa auth, cukup untuk MVP kompetisi).

## Acceptance criteria

- Bisa submit laporan kepadatan dari dalam app (bukan curl) untuk halte transfer di rute Kalideres→PGC.
- Setelah submit, search ulang rute yang sama menunjukkan skor & `crowd_level` berubah sesuai laporan — Skenario 2 dari runbook bisa didemokan penuh lewat app, end-to-end.
- **Diverifikasi eksplisit dari kondisi awal peta benar-benar kosong (0 laporan) → submit 1 laporan → marker langsung terlihat di peta tanpa refresh manual/reload halaman.** Ini skenario persis yang akan terjadi live di depan juri — wajib dites dari kondisi kosong, bukan dari kondisi yang sudah ada beberapa laporan.
