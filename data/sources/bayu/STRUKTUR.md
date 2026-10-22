# Struktur 3 Spreadsheet Bayu (Task 0)

Dihasilkan otomatis dari file xlsx yang diunduh ke folder ini. Angka baris
TIDAK termasuk baris header.

> **Unduhan wajib diverifikasi.** `TJ.xlsx` pertama kali terunduh terpotong
> (4.660.261 dari 7.561.029 byte) tanpa pesan error apa pun — `file` tetap
> melaporkannya sebagai "Microsoft Excel 2007+" padahal arsipnya rusak.
> Selalu buka dengan openpyxl/zipfile untuk membuktikan file utuh.

## TJ.xlsx

13 tab, urutan persis seperti di workbook:

1. **`agency`** — 1 baris (GTFS)
   - kolom: `kode HK dan HL pada daat transportasi transjakarta itu artinya apa ?`, `agency_name`, `agency_url`, `agency_timezone`, `agency_lang`, `agency_phone`, `agency_email`, `ticketing_deep_link_id`
2. **`calendar`** — 7 baris (GTFS)
   - kolom: `service_id`, `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`, `start_date`, `end_date`
3. **`fare_attributes`** — 6 baris (GTFS)
   - kolom: `fare_id`, `price`, `currency_type`, `payment_method`, `transfers`, `agency_id`, `transfer_duration`
4. **`fare_rules`** — 240 baris (GTFS)
   - kolom: `fare_id`, `route_id`, `origin_id`, `destination_id`, `contains_id`
5. **`frequencies`** — 753 baris (GTFS)
   - kolom: `trip_id`, `start_time`, `end_time`, `headway_secs`, `exact_times`
6. **`routes`** — 240 baris (GTFS)
   - kolom: `route_id`, `agency_id`, `route_short_name`, `route_long_name`, `route_desc`, `route_type`, `route_url`, `route_color`, `route_text_color`, `route_sort_order`, `ticketing_deep_link_id`
7. **`shapes`** — 242485 baris (GTFS)
   - kolom: `shape_id`, `shape_pt_sequence`, `shape_pt_lat`, `shape_pt_lon`, `shape_dist_traveled`
8. **`stop_times`** — 26427 baris (GTFS)
   - kolom: `trip_id`, `stop_sequence`, `stop_id`, `arrival_time`, `departure_time`, `stop_headsign`, `pickup_type`, `drop_off_type`, `continuous_pickup`, `continuous_drop_off`, `shape_dist_traveled`, `timepoint`, `ticketing_type`
9. **`stops`** — 8091 baris (GTFS)
   - kolom: `stop_id`, `stop_code`, `stop_name`, `stop_desc`, `stop_lat`, `stop_lon`, `zone_id`, `stop_url`, `location_type`, `parent_station`, `stop_timezone`, `wheelchair_boarding`, `platform_code`
10. **`ticketing_deep_links`** — 1 baris (GTFS)
   - kolom: `ticketing_deep_link_id`, `web_url`, `android_intent_uri`, `ios_universal_link_url`
11. **`ticketing_identifiers`** — 5059 baris (GTFS)
   - kolom: `ticketing_stop_id`, `stop_id`, `agency_id`
12. **`trips`** — 700 baris (GTFS)
   - kolom: `trip_id`, `route_id`, `service_id`, `trip_headsign`, `trip_short_name`, `direction_id`, `block_id`, `shape_id`, `wheelchair_accessible`, `bikes_allowed`, `ticketing_trip_id`, `ticketing_type`
13. **`transfers`** — 14 baris (GTFS)
   - kolom: `from_stop_id`, `to_stop_id`, `transfer_type`, `min_transfer_time`

## BRT_TJ.xlsx

14 tab, urutan persis seperti di workbook:

1. **`Ringkasan`** — 29 baris (non-GTFS)
   - kolom: `GTFS Transjakarta: BRT saja (sudah dibersihkan)`
2. **`routes`** — 30 baris (GTFS)
   - kolom: `route_id`, `agency_id`, `route_short_name`, `route_long_name`, `route_desc`, `route_type`, `route_url`, `route_color`, `route_text_color`, `route_sort_order`, `ticketing_deep_link_id`
3. **`trips`** — 163 baris (GTFS)
   - kolom: `trip_id`, `route_id`, `service_id`, `trip_headsign`, `trip_short_name`, `direction_id`, `block_id`, `shape_id`, `wheelchair_accessible`, `bikes_allowed`, `ticketing_trip_id`, `ticketing_type`
4. **`stop_times`** — 3700 baris (GTFS)
   - kolom: `trip_id`, `stop_sequence`, `stop_id`, `arrival_time`, `departure_time`, `stop_headsign`, `pickup_type`, `drop_off_type`, `continuous_pickup`, `continuous_drop_off`, `shape_dist_traveled`, `timepoint`, `ticketing_type`
5. **`stops`** — 780 baris (GTFS)
   - kolom: `stop_id`, `stop_code`, `stop_name`, `stop_desc`, `stop_lat`, `stop_lon`, `zone_id`, `stop_url`, `location_type`, `parent_station`, `stop_timezone`, `wheelchair_boarding`, `platform_code`
6. **`shapes`** — 53856 baris (GTFS)
   - kolom: `shape_id`, `shape_pt_sequence`, `shape_pt_lat`, `shape_pt_lon`, `shape_dist_traveled`
7. **`frequencies`** — 163 baris (GTFS)
   - kolom: `trip_id`, `start_time`, `end_time`, `headway_secs`, `exact_times`
8. **`calendar`** — 4 baris (GTFS)
   - kolom: `service_id`, `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`, `start_date`, `end_date`
9. **`fare_attributes`** — 1 baris (GTFS)
   - kolom: `fare_id`, `price`, `currency_type`, `payment_method`, `transfers`, `agency_id`, `transfer_duration`
10. **`fare_rules`** — 30 baris (GTFS)
   - kolom: `fare_id`, `route_id`, `origin_id`, `destination_id`, `contains_id`
11. **`agency`** — 1 baris (GTFS)
   - kolom: `agency_id`, `agency_name`, `agency_url`, `agency_timezone`, `agency_lang`, `agency_phone`, `agency_email`, `ticketing_deep_link_id`
12. **`transfers`** — 12 baris (GTFS)
   - kolom: `from_stop_id`, `to_stop_id`, `transfer_type`, `min_transfer_time`
13. **`ticketing_identifiers`** — 4748 baris (GTFS)
   - kolom: `ticketing_stop_id`, `stop_id`, `agency_id`
14. **`ticketing_deep_links`** — 1 baris (GTFS)
   - kolom: `ticketing_deep_link_id`, `web_url`, `android_intent_uri`, `ios_universal_link_url`

## KRL.xlsx

7 tab, urutan persis seperti di workbook:

1. **`Baca Saya`** — 23 baris (non-GTFS)
   - kolom: `Data KRL Commuter Line Jabodetabek`
2. **`Stasiun`** — 85 baris (non-GTFS)
   - kolom: `Kode`, `Nama Stasiun`, `Catatan`
3. **`Tarif`** — 3382 baris (non-GTFS)
   - kolom: `Stasiun Asal`, `Stasiun Tujuan`, `Tarif (Rp)`, `Jarak (km)`, `Kode Asal`, `Kode Tujuan`
4. **`Matriks Tarif`** — 85 baris (non-GTFS)
   - kolom: `Matriks Tarif KRL Jabodetabek (Rp)`
5. **`Daftar Kereta`** — 1000 baris (non-GTFS)
   - kolom: `No. KA`, `Lintas`, `Rute`, `Stasiun Awal`, `Jam Berangkat`, `Stasiun Akhir`, `Jam Tiba`, `Jumlah Perhentian`
6. **`Detail Perhentian`** — 16475 baris (non-GTFS)
   - kolom: `No. KA`, `Lintas`, `Urutan`, `Stasiun`, `Jam Estimasi`, `Transit`, `Kode Stasiun`
7. **`Jadwal per Stasiun`** — 17490 baris (non-GTFS)
   - kolom: `Stasiun`, `Jam Estimasi`, `No. KA`, `Lintas`, `Tujuan Akhir`, `Jam Tiba di Tujuan`, `Rute`, `Kode Stasiun`

---

## Feed GTFS yang SEKARANG dipakai OTP2

Sumber: `backend/otp2-setup/data/*.zip` (yang benar-benar dimuat build graph).

### krl_gtfs.zip

- `agency.txt` — 1 baris
- `calendar.txt` — 1 baris
- `fare_attributes.txt` — 11 baris
- `fare_rules.txt` — 6604 baris
- `routes.txt` — 5 baris
- `stop_times.txt` — 16094 baris
- `stops.txt` — 83 baris
- `trips.txt` — 985 baris

### transjakarta_gtfs.zip

- `agency.txt` — 1 baris
- `calendar.txt` — 7 baris
- `fare_attributes.txt` — 6 baris
- `fare_rules.txt` — 240 baris
- `frequencies.txt` — 753 baris
- `routes.txt` — 240 baris
- `shapes.txt` — 242485 baris
- `stop_times.txt` — 26427 baris
- `stops.txt` — 8091 baris
- `ticketing_deep_links.txt` — 1 baris
- `ticketing_identifiers.txt` — 5059 baris
- `transfers.txt` — 14 baris
- `trips.txt` — 700 baris

---

## Perbandingan sheet Bayu vs feed OTP2

### TJ.xlsx = feed OTP2, versi yang SAMA

Jumlah baris cocok persis di SELURUH 13 file, termasuk yang besar:

| file | TJ.xlsx | transjakarta_gtfs.zip |
|---|---:|---:|
| `agency` | 1 | 1 |
| `calendar` | 7 | 7 |
| `fare_attributes` | 6 | 6 |
| `fare_rules` | 240 | 240 |
| `frequencies` | 753 | 753 |
| `routes` | 240 | 240 |
| `shapes` | 242485 | 242485 |
| `stop_times` | 26427 | 26427 |
| `stops` | 8091 | 8091 |
| `ticketing_deep_links` | 1 | 1 |
| `ticketing_identifiers` | 5059 | 5059 |
| `transfers` | 14 | 14 |
| `trips` | 700 | 700 |

Kesimpulan: bukan versi berbeda — ini feed yang sama, diekspor ke xlsx.

**Cacat yang ditemukan:** di tab `agency`, sel A1 tertimpa teks
"kode HK dan HL pada daat transportasi transjakarta itu artinya apa ?",
menggantikan nama kolom `agency_id`. Baris datanya sendiri utuh dan identik
dengan `agency.txt` di OTP2. Konversi balik xlsx->GTFS akan menghasilkan
feed rusak kalau sel ini tidak diperbaiki lebih dulu.

### BRT_TJ.xlsx = SUBSET dari feed TJ, bukan feed terpisah

| file | BRT_TJ | TJ penuh |
|---|---:|---:|
| `routes` | 30 | 240 |
| `trips` | 163 | 700 |
| `stops` | 780 | 8091 |
| `stop_times` | 3700 | 26427 |
| `shapes` | 53856 | 242485 |
| `frequencies` | 163 | 753 |
| `transfers` | 12 | 14 |
| `fare_attributes` | 1 | 6 |

Tab `Ringkasan` di file itu menyatakannya sendiri: *"GTFS Transjakarta:
BRT saja (sudah dibersihkan)"*. Jadi ini koridor BRT yang disaring dari feed
penuh, bukan sumber data baru.

### KRL.xlsx = format BERBEDA, dan isinya tidak sama dengan feed OTP2

Tab-nya bukan nama file GTFS, melainkan tampilan analitis untuk manusia
(`Stasiun`, `Matriks Tarif`, `Jadwal per Stasiun`). Angkanya juga tidak sama:

| hal | KRL.xlsx | krl_gtfs.zip (OTP2) |
|---|---:|---:|
| stasiun | 85 (tab `Stasiun`) | 83 (`stops.txt`) |
| kereta/trip | 1000 (tab `Daftar Kereta`) | 985 (`trips.txt`) |
| perhentian | 16475 (tab `Detail Perhentian`) | 16094 (`stop_times.txt`) |
| tarif | 3382 (tab `Tarif`) | 6604 (`fare_rules.txt`) |

Kesimpulan: versi berbeda, bukan cuma format berbeda.

---

## Konsekuensi untuk Task 1 (format export)

Ada DUA konvensi berbeda di tiga sheet ini, tidak satu:

1. **TJ & BRT_TJ** — satu tab per file GTFS, nama kolom persis nama kolom
   GTFS. Bisa dikonversi bolak-balik secara mekanis.
2. **KRL** — tabel turunan untuk dibaca manusia (matriks tarif, jadwal per
   stasiun). TIDAK bisa dihasilkan dari GTFS tanpa aturan peringkasan
   tambahan, dan tidak bisa dikonversi balik tanpa kehilangan informasi.

`gtfs_to_xlsx` mengikuti konvensi (1), karena cuma itu yang memenuhi syarat
round-trip di Task 1. Urutan tab memakai urutan kurasi BRT_TJ (routes, trips,
stop_times, stops, ...) yang lebih mudah dibaca daripada urutan alfabetis TJ.
