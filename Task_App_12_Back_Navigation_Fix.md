# Task App-12: Perbaiki Navigasi Tombol Back (Skip ke Beranda)

**Assignee:** Lippable
**Prioritas: Tinggi** — ditemukan langsung dari rehearsal fisik, masalah UX yang terlihat jelas di depan siapa pun yang pakai app.

## Tujuan

Tombol back HP (hardware/gesture back Android) dari layar detail/hasil rute saat ini langsung melompat ke Beranda, melewati layar pencarian/hasil rute sebelumnya. Seharusnya kembali selangkah demi selangkah sesuai urutan navigasi maju yang dialami user.

## Konteks

Ditemukan saat rehearsal fisik pertama di HP — user pilih satu rute (masuk ke detail), tekan back, ekspektasinya balik ke daftar hasil rute, tapi malah langsung ke Beranda.

## Lingkup

- Investigasi dulu penyebabnya, kemungkinan salah satu dari:
  - Navigasi ke layar detail rute memakai `router.replace()` (yang menghapus layar sebelumnya dari stack) padahal seharusnya `router.push()` (yang menambah ke stack, bisa di-back).
  - "Hasil rute" sebenarnya bukan route/screen terpisah di navigation stack, cuma state di dalam screen yang sama — kalau begitu, tombol back OS memang tidak akan "tahu" ada state itu untuk di-back-kan, perlu direstrukturisasi jadi route sungguhan.
- Perbaiki supaya urutan back: **detail rute → daftar hasil rute → layar pencarian → beranda**, sesuai urutan yang dialami user saat maju.

## Batasan eksplisit

- Jangan ubah alur navigasi maju (yang sudah bekerja baik) — fokus murni ke behavior tombol back.

## Acceptance criteria

- Dari layar detail rute, tekan back HP → kembali ke daftar hasil rute (bukan Beranda).
- Dari daftar hasil rute, tekan back lagi → kembali ke layar pencarian, dengan input yang sebelumnya diisi (asal, tujuan) masih ada — tidak hilang/ke-reset.
- Diverifikasi di device fisik lewat dev client, bukan cuma web (perilaku tombol back native beda dari web).
