# Task Backend-11: Endpoint Halte/Stasiun Terdekat (4 Moda)

**Assignee:** Lippable

## Tujuan

Sediakan endpoint yang mengembalikan daftar halte/stasiun terdekat dari lokasi GPS user, mencakup 4 moda: TransJakarta, MRT, LRT, JakLingko (mikrotrans feeder) — murni **daftar info lokasi**, bukan routing/perhitungan rute lewat moda-moda itu.

## Konteks

Ini beda dari permintaan awal (routing penuh lewat MRT/LRT yang sudah dicoret karena tidak ada GTFS publik). Ini cuma daftar "stasiun/halte terdekat" — proximity-based, jadi datanya jauh lebih ringan: TransJakarta + JakLingko (mikrotrans) sudah ada di OTP2 (prefix `G` dan `B` dari investigasi Backend-09), MRT + LRT perlu data statis manual (jumlah stasiunnya kecil, gampang dikurasi).

## Lingkup

1. **TransJakarta + JakLingko (mikrotrans feeder):** dari OTP2 yang sudah dimuat — filter berdasarkan jarak ke koordinat user, ambil yang terdekat (misal 10–20 titik, atau radius 1–2km). **Bedakan prefix `G` (halte BRT) vs prefix `B` (mikrotrans)** sebagai dua kategori berbeda di response, supaya UI bisa label dengan benar ("Halte TransJakarta" vs "Titik JakLingko/Mikrotrans").
2. **MRT + LRT:** data statis manual — buat daftar stasiun (nama, lat, lon) untuk MRT Jakarta dan LRT Jakarta. Ini bisa hardcode di file JSON/constant di backend, tidak perlu GTFS. **Verifikasi dulu jumlah stasiun aktual** (jangan asumsi angka tanpa cek), dan pastikan koordinatnya akurat (cross-check ke sumber yang jelas, misal web resmi/peta publik).
3. Endpoint baru, misal `GET /nearby-stops?lat=&lon=&radius=` — gabungkan hasil dari 4 sumber di atas, urutkan berdasarkan jarak terdekat (garis lurus/haversine, bukan jarak jalan kaki — cukup untuk kebutuhan "lihat yang deket", jangan hitung rute jalan kaki ke tiap titik karena terlalu berat), kembalikan dengan field: nama, moda, jarak (meter), lat, lon.

## Batasan eksplisit

- Jangan bangun routing/perhitungan rute lewat MRT/LRT — ini murni daftar lokasi, bukan perhitungan perjalanan.
- Jarak yang dihitung cukup garis lurus (haversine) — jangan query rute jalan kaki ke tiap titik terdekat, itu terlalu berat untuk sekadar "lihat yang deket".

## Acceptance criteria

- Endpoint mengembalikan daftar halte/stasiun 4 moda terdekat dari koordinat yang diberikan, terurut berdasarkan jarak.
- Data MRT/LRT diverifikasi akurat (nama & lokasi benar, dicek manual terhadap sumber resmi) sebelum dipakai.
