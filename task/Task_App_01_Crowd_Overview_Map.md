# Task App-01: Layar Peta Kepadatan (Overview Map)

**Assignee:** Lippable
**Prasyarat:** Task Backend-07 selesai.
**Status:** Nice-to-have — fitur tambahan buat memperkuat cerita demo, bukan blocker. Kalau waktu mepet, ini dipotong duluan sebelum menyentuh fitur pencarian rute inti.

## Tujuan

Layar baru di app yang menampilkan peta dengan marker berwarna sesuai level kepadatan tiap halte yang punya laporan aktif — mirip traffic layer Google Maps, tapi untuk kepadatan transit, dan pakai **data asli** dari crowdsource kalian sendiri (bukan data sintetis seperti di dashboard yang disisihkan).

## Lingkup

- Tambah satu layar baru (tab atau halaman terpisah) yang memanggil endpoint list dari Task Backend-07.
- Render peta (reuse komponen map yang sudah ada di app) dengan marker per halte, warna sesuai level (low/moderate/high).
- Tap marker → tampilkan info dasar (nama halte, level kepadatan, waktu laporan terakhir) — popup sederhana, tidak perlu selengkap fitur di dashboard yang disisihkan.

## Batasan eksplisit

- Jangan bangun ulang fitur-fitur dashboard yang disisihkan (leaderboard, flagging station, dll) — cukup peta + marker + info dasar.
- Jangan integrasikan data sintetis apa pun — hanya data asli dari endpoint Backend-07.
- Jangan kerjakan versi native — tetap web-only sesuai keputusan sebelumnya.

## Acceptance criteria

- Layar baru menampilkan peta dengan marker warna sesuai kepadatan real dari backend.
- Tap marker menampilkan info halte dasar.
- Kalau belum ada laporan sama sekali, tampilkan pesan jelas ("Belum ada laporan kepadatan saat ini") — bukan peta kosong tanpa penjelasan.
