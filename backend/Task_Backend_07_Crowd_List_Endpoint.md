# Task Backend-07: Endpoint Daftar Kepadatan Semua Halte

**Assignee:** Lippable
**Prasyarat:** Task Backend-04 selesai (`crowdDensity.ts` sudah punya logic agregasi per halte).
**Status:** Nice-to-have — kalau waktu mepet mendekati hari-H, ini yang pertama dikorbankan, bukan fitur pencarian rute inti.

## Tujuan

Endpoint baru yang me-list semua halte beserta level kepadatan terkini (kalau ada laporan aktif), untuk mendukung tampilan peta overview mirip Google Maps traffic layer — bukan per-halte satu-satu seperti endpoint yang sudah ada.

## Lingkup

- Endpoint baru (GET, path terpisah dari `/crowd-reports/:stop_id` yang sudah ada — pastikan routing Express tidak bentrok) yang me-list semua `stop_id` yang **punya laporan aktif** dalam window yang sama seperti agregasi individual (15 menit terakhir).
- Untuk tiap halte dalam list, sertakan: `stop_id`, `name`, `lat`, `lng` (join ke data GTFS stops yang sudah dimuat backend), `level` (agregat), `reported_at` (laporan terakhir).
- **Halte yang tidak punya laporan sama sekali TIDAK dimasukkan ke response** — bukan diisi level netral/default. Biar frontend yang memutuskan cara menampilkan "belum ada data" secara visual.

## Batasan eksplisit

- Jangan ubah endpoint `GET /crowd-reports/:stop_id` yang sudah ada — ini endpoint baru terpisah.
- Jangan render peta atau logic tampilan apa pun di sini — murni backend, layar peta itu task terpisah (App-01).
- Jangan tambah field yang tidak diminta (skip `passenger_count`, `bus_arrival_eta_sec`, atau apa pun yang menyerupai data GPS armada/tap-in real-time — itu tetap tidak tersedia dan tidak boleh direka-reka, persis prinsip yang sudah dipegang sejak awal).

## Acceptance criteria

- Endpoint list mengembalikan halte-halte yang benar-benar punya laporan aktif, dengan koordinat yang cocok data GTFS.
- Halte tanpa laporan tidak muncul di response.
- Endpoint `/crowd-reports/:stop_id` yang lama tetap berfungsi seperti sebelumnya (regresi dicek, bukan diasumsikan).
