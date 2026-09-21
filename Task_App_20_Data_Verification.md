# Task App-20: Verifikasi End-to-End Data Harga, Waktu, dan Lokasi Halte

**Assignee:** Lippable

## Tujuan

Pastikan tiga jenis data yang ditampilkan ke user itu akurat dan konsisten sepanjang alur — bukan cuma "kelihatan masuk akal", tapi diverifikasi silang ke sumbernya.

## Lingkup

1. **Harga/tarif:** cek nilai yang ditampilkan di hasil rute dan layar navigasi sama dengan yang dihitung backend (`Rp3.500` flat TransJakarta) — pastikan tidak ada pembulatan/transformasi yang salah di frontend.
2. **Waktu keberangkatan:** pastikan `departure_time` yang diisi user di Beranda (App-08) benar-benar dipakai konsisten sampai ke layar hasil rute DAN layar navigasi — cek apakah layar navigasi menampilkan waktu yang sesuai dengan yang diinput di awal, bukan "sekarang" secara default kalau user sudah eksplisit mengisi waktu tertentu.
3. **Lokasi terminal/halte:** spot-check beberapa halte yang ditampilkan (baik di hasil rute, Peta Kepadatan, maupun Halte Terdekat) — bandingkan koordinatnya ke peta publik (Google Maps/OSM) untuk memastikan tidak melenceng jauh dari lokasi asli.

## Acceptance criteria

- Laporan jelas untuk masing-masing dari 3 kategori: sudah akurat/konsisten, atau ditemukan selisih — dengan contoh konkret (bukan generalisasi "kelihatannya benar").
- Kalau ditemukan selisih, laporkan detail sebelum memperbaiki — jangan langsung ubah tanpa jelas akar masalahnya.
