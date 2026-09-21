# Task App-16: Perbaikan Input Waktu Berangkat

**Assignee:** Lippable

## Tujuan

Dua perbaikan UX di `DepartureTimeField` (App-08):
1. Batasi input jam ke rentang valid (0–23), bukan bisa diisi sampai 24 atau lebih.
2. Auto-pindah fokus ke kolom menit begitu user selesai mengetik 2 digit di kolom jam — mengurangi satu tap manual, mirip pola input OTP/kode verifikasi yang familiar.

## Lingkup

- Validasi input jam: tolak/batasi nilai di luar 0–23 saat diketik, bukan cuma divalidasi setelah submit.
- Begitu 2 digit sudah dimasukkan di kolom jam, otomatis pindahkan fokus keyboard ke kolom menit tanpa perlu user tap manual.
- Kolom menit tetap perlu validasi sendiri (0–59) yang sudah ada — pastikan tidak rusak oleh perubahan ini.

## Acceptance criteria

- Mengetik jam di luar 0–23 tidak menghasilkan nilai tidak valid yang tersimpan.
- Setelah 2 digit di kolom jam, fokus otomatis pindah ke kolom menit.
- Alur submit waktu berangkat (App-08) tetap berfungsi normal setelah perubahan ini.
