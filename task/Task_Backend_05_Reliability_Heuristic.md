# Task Backend-05: Skor Risiko dari Headway GTFS

**Assignee:** Lippable
**Prasyarat:** Task Backend-03c selesai dan di-merge (untuk menghindari konflik file dengan Backend-04 yang jalan paralel).

## Tujuan

Isi field `reliability` (`score` numerik + `risk` level) di `RouteCandidate`, dihitung dari headway (frekuensi kedatangan) GTFS di titik transfer — sesuai PRD P0.4. Ini heuristik/rumus, **bukan** model machine learning — menggantikan fungsi Model 01 punya Bayu tanpa butuh data historis yang memang tidak tersedia.

## Lingkup

- Fungsi ekstraksi headway rata-rata untuk kombinasi route+stop+window waktu tertentu dari data GTFS (pakai `frequencies.txt` kalau tersedia di feed TransJakarta; kalau tidak ada, hitung dari selisih waktu keberangkatan berurutan di `stop_times.txt`).
- Terapkan khusus di **titik transfer** tiap rute (bukan di setiap leg) — ini yang paling relevan untuk "risiko ketinggalan sambungan" sesuai framing PRD. Untuk rute tanpa transfer (direct), tetap hitung `reliability` dari headway leg utamanya sendiri — jangan dibiarkan `undefined` tanpa alasan.
- Rumus scoring awal (boleh disesuaikan, tapi threshold yang dipakai wajib didokumentasikan di code comment/README beserta alasannya, bukan angka sembarangan tanpa penjelasan):
  - Headway < 5 menit → `risk: "low"` → `score: 0.9`
  - Headway 5–10 menit → `risk: "medium"` → `score: 0.5`
  - Headway > 10 menit → `risk: "high"` → `score: 0.1`
  - Jika `undefined` (data tidak ada), gunakan 0.5 (netral/belum tahu)
- **Contribution ke `recommendation_score`** (dihitung di akhir `/routes`, kombinasi dengan Task 04): `reliability.score` dipakai langsung sebagai bobot dalam rumus akhir (lihat Task Backend-06 untuk detail).

## Batasan eksplisit

- Jangan pakai machine learning apa pun — murni fungsi/rumus dari data GTFS, sesuai keputusan yang sudah disepakati (Model 01 tidak dibangun di scope kompetisi ini).
- Jangan cari atau pakai data on-time performance historis — itu tidak tersedia publik; cukup pakai headway terjadwal.
- Jangan ubah skema `RouteCandidate` dari Task Backend-01 — isi field `reliability` yang sudah ada, jangan tambah field baru.

## Acceptance criteria

- Untuk 3 rute AC (Blok M–Kota, Kalideres–PGC, Grogol–Kampung Melayu), field `reliability` terisi dengan `score` dan `risk` yang masuk akal — diverifikasi manual dengan mengecek headway aktual dari GTFS di titik transfer masing-masing rute, dibandingkan dengan level yang dihasilkan.
- Rute tanpa transfer tetap punya `reliability` terisi, dihitung dari headway leg utamanya.
- `tsc --noEmit` lolos.
