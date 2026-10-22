# Task Backend-12: Scrape & Cache Data MRT dari API Pihak Ketiga (Statis)

**Assignee:** Lippable

## Tujuan

Ambil data MRT Jakarta (stasiun, jadwal, estimasi waktu+tarif) dari API tidak resmi `https://github.com/reksamamur/mrt-jakarta-api`, simpan sebagai data statis di backend kita sendiri — **bukan** dipanggil live tiap kali user pakai app.

## Konteks

API ini adalah proyek pihak ketiga tidak resmi (proyek hobi kecil, hosting di Railway, tidak terjamin uptime-nya). Kalau server itu down/lambat pas demo di depan juri, itu di luar kendali kita sepenuhnya. Makanya data **wajib** di-scrape sekali dan disimpan statis, bukan live-fetch saat runtime.

## Lingkup

- Tulis skrip scraping sekali-jalan (terpisah dari runtime backend Express, mirip pola `scripts/download-gtfs.sh`) yang memanggil:
  1. `GET /v1/stations` — semua stasiun MRT
  2. `GET /v1/station/{id}/schedules` — jadwal lengkap weekday/weekend tiap stasiun (ini cukup jadi sumber utama; endpoint "schedules/now" dan "schedules/{timestamp}" cuma hitungan turunan dari data ini — tidak perlu di-scrape terpisah, bisa dihitung sendiri di backend kita dari jadwal mentah kalau dibutuhkan nanti)
  3. `GET /v1/station/{id}/estimates/{id2}` — estimasi waktu+tarif antar 2 stasiun, untuk pasangan stasiun yang relevan (minimal yang dipakai skenario demo, atau semua kombinasi kalau jumlahnya masih wajar untuk 13 stasiun)
- **Jangan scrape endpoint `retail` dan `facilities`** — dua-duanya tidak relevan untuk tujuan "hasil rute lebih real" (info ATM/hotel/restoran tidak menambah nilai ke situ), di luar cakupan tugas ini.
- Simpan hasilnya sebagai file JSON statis di backend (misal `src/data/mrtSchedulesEstimates.json`).
- Buat endpoint baru (atau perluas data statis MRT dari Backend-11) yang menyajikan data ini dari file statis, bukan dari panggilan API eksternal langsung.

## Batasan eksplisit

- Backend Express yang jalan saat demo **tidak boleh** memanggil API eksternal ini secara live — itu resiko ketergantungan ke server pihak ketiga yang tidak terjamin.
- Kalau API ini down/berubah struktur saat scraping dilakukan, laporkan itu — jangan asumsikan data lama masih valid tanpa verifikasi ulang.

## Acceptance criteria

- Data MRT (stasiun, jadwal, estimasi waktu+tarif) tersimpan statis di backend, tidak bergantung pada API eksternal saat runtime.
- Endpoint yang menyajikan data ini diverifikasi mengembalikan data yang benar dan masuk akal.
