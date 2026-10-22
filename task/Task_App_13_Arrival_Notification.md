# Task App-13: Notifikasi Selesai Navigasi (Tiba di Tujuan)

**Assignee:** Lippable

## Tujuan

Saat navigasi selesai (user tiba di lokasi tujuan), tampilkan notifikasi/layar ucapan selamat & terima kasih telah menggunakan app — bukan dibiarkan tanpa penutup yang jelas.

## ⚠️ WAJIB dicek dulu sebelum implementasi

Apakah layar Navigasi (`NavigateMap`) saat ini **sudah melacak posisi GPS user secara live/berkelanjutan**, atau cuma menampilkan peta rute statis (preview) tanpa update posisi real-time?

- **Kalau sudah ada live tracking** — lanjut ke lingkup di bawah, tinggal tambah logic deteksi kedatangan.
- **Kalau belum ada** (cuma preview statis) — fitur ini **tidak bisa dibangun** tanpa live tracking lebih dulu (ini scope yang sempat dibahas sebagai "App-06/App-07 live tracking" tapi belum pernah dikerjakan). **Laporkan balik temuan ini dan jangan lanjut implementasi** sampai ada keputusan eksplisit apakah live tracking mau dibangun duluan — itu scope lebih besar, perlu dipertimbangkan lagi mengingat sisa waktu kompetisi.

## Lingkup (lanjutkan HANYA jika live tracking sudah ada)

- Tambah logic: bandingkan posisi GPS user saat ini dengan koordinat tujuan yang dipilih — kalau sudah dalam radius tertentu (misal 50–100 meter, sesuaikan dengan akurasi GPS wajar di HP biasa), anggap "tiba".
- Tampilkan modal/layar: pesan ucapan selamat + terima kasih (contoh: *"Selamat! Anda telah tiba di [nama tujuan]. Terima kasih telah menggunakan SmartRoute AI."*), dengan tombol lanjut (misal "Kembali ke Beranda" atau "Cari rute baru").
- Pastikan notifikasi ini cuma muncul **sekali** per sesi navigasi — tidak berulang-ulang kalau user diam di dalam radius itu.

## Batasan eksplisit

- Jangan bangun live tracking dari nol di task ini kalau ternyata belum ada — itu task terpisah yang lebih besar, perlu keputusan eksplisit dulu sebelum dikerjakan.
- Radius deteksi "tiba" jangan terlalu ketat (misal <10 meter) — akurasi GPS HP biasa bisa meleset puluhan meter, radius yang terlalu ketat bisa bikin notifikasi susah/tidak pernah muncul.

## Acceptance criteria

- Laporan jelas: apakah live tracking sudah ada atau belum, **sebelum** lanjut implementasi apa pun.
- Kalau lanjut: notifikasi "tiba di tujuan" muncul saat posisi GPS user sudah dekat dengan koordinat tujuan, dengan pesan ucapan yang sesuai, muncul cuma sekali per sesi.
