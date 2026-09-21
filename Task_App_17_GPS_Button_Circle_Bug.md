# Task App-17: Reposisi Tombol GPS + Perbaikan Bug Layout Lingkaran

**Assignee:** Lippable

## Tujuan

Dua perbaikan di layar Navigasi (`navigate.tsx`):
1. Pindahkan tombol "lock GPS"/recenter dari posisi atas ke posisi yang lebih mudah dijangkau jempol (misal kanan-bawah), supaya tidak menghalangi pandangan ke peta di area atas.
2. Perbaiki bug visual: muncul lingkaran aneh di peta saat zoom atau peta digerakkan.

## Lingkup

- Reposisi tombol GPS lock — cek posisi tombol-tombol lain yang sudah ada (misal tombol pengaturan/gear biru) supaya tidak tabrakan/tumpuk.
- **Investigasi dulu penyebab bug lingkaran** sebelum memperbaiki: kemungkinan itu lingkaran radius akurasi GPS yang render tidak semestinya, atau artefak dari komponen tombol itu sendiri saat re-render akibat gesture zoom/pan. Pastikan penyebabnya jelas dulu sebelum menambal.
- Perbaiki sesuai akar penyebab yang ditemukan.

## Acceptance criteria

- Tombol GPS lock berada di posisi yang tidak menghalangi pandangan utama ke peta, mudah dijangkau saat dipegang satu tangan.
- Lingkaran aneh tidak lagi muncul saat zoom in/out atau peta digeser — diverifikasi dengan mengulangi gesture yang sama beberapa kali di device fisik.
