# KRL Commuter Line Indonesia - Schedules & Fares / Jadwal & Tarif KRL Commuter Line

[![Kaggle](https://img.shields.io/badge/Kaggle-Dataset-blue.svg?logo=kaggle)](https://www.kaggle.com/)
[![License](https://img.shields.io/badge/License-CC_BY--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

---

## 🇮🇩 Bahasa Indonesia

### Tentang Dataset Ini
Dataset ini menyediakan informasi lengkap mengenai jadwal perjalanan, stasiun, rute, serta matriks tarif untuk **KRL Commuter Line** yang dioperasikan oleh **PT Kereta Commuter Indonesia (KAI Commuter)**. Data ini mencakup wilayah operasional utama:
1.  **Wilayah I (Jabodetabek)**

Dataset ini berguna untuk analisis spasial perkotaan, perencanaan rute, optimalisasi transportasi publik, visualisasi persebaran armada, dan pengembangan aplikasi penunjang perjalanan.

> [!NOTE]
> Data ini disinkronisasikan dan diambil langsung dari situs resmi **kci.id** pada tanggal **1 Juli 2026**.

---

### Struktur Folder & File
Dataset dikemas sedemikian rupa agar ramah terhadap pengolahan data tabular sekaligus terstruktur rapi:

*   **`stations.json`**: Daftar seluruh stasiun KRL Commuter Line beserta status keaktifannya.
*   **`meta.json`**: Metadata sinkronisasi data (waktu sinkronisasi terakhir, jumlah stasiun, dan sumber API).
*   **`fares_all.json`**: File gabungan tunggal berisi matriks tarif lengkap dan jarak antar stasiun (dalam km).
*   **`schedules_by_train_all.json`**: File gabungan tunggal berisi jadwal perjalanan lengkap setiap nomor kereta (KRL) beserta daftar stasiun pemberhentian berurutan.
*   **`schedules_by_station_all.json`**: File gabungan tunggal berisi jadwal kedatangan/keberangkatan kereta di setiap stasiun, dipetakan dengan kode stasiun sebagai kunci (key).
*   **`fares.zip`**: Arsip berisi file tarif individual untuk setiap relasi stasiun asal-tujuan (format: `fares/<asal>-<tujuan>.json`).
*   **`schedules.zip`**: Arsip berisi file jadwal individual yang terbagi menjadi:
    *   `schedules/by-train/`: Jadwal rute per nomor kereta (`<train_id>.json`).
    *   `schedules/by-station/`: Jadwal kedatangan per kode stasiun (`<station_code>.json`).

---

### Skema & Kamus Data

#### 1. `stations.json` (Daftar Stasiun)
```json
[
  {
    "id": "AC",
    "name": "ANCOL",
    "groupWil": 0,
    "fgEnable": 1,
    "active": true
  }
]
```
*   `id` (string): Kode stasiun unik (2-4 karakter, misal: MRI, YK, AC).
*   `name` (string): Nama stasiun.
*   `groupWil` (integer): Kode wilayah stasiun.
*   `fgEnable` (integer): Flag status stasiun (1 = aktif, 0 = tidak).
*   `active` (boolean): Menunjukkan apakah stasiun aktif dalam operasional komuter.

#### 2. `fares_all.json` (Matriks Tarif)
```json
[
  {
    "sta_code_from": "AC",
    "sta_name_from": "ANCOL",
    "sta_code_to": "BJD",
    "sta_name_to": "BOJONGGEDE",
    "fare": 6000,
    "distance": 46.512
  }
]
```
*   `sta_code_from` (string): Kode stasiun keberangkatan (asal).
*   `sta_name_from` (string): Nama stasiun keberangkatan (asal).
*   `sta_code_to` (string): Kode stasiun tujuan.
*   `sta_name_to` (string): Nama stasiun tujuan.
*   `fare` (integer): Besaran tarif dalam Rupiah (IDR).
*   `distance` (double): Jarak tempuh perjalanan dalam kilometer (km).

#### 3. Jadwal per Kereta (`schedules_by_train_all.json`)
```json
[
  {
    "train_id": "1000",
    "ka_name": "COMMUTER LINE BOGOR",
    "color": "#E30A16",
    "stops": [
      {
        "station_id": "MRI",
        "station_name": "MANGGARAI",
        "time_est": "05:10:00",
        "transit_station": true,
        "transit": ["#0000ff", "#ff0000"]
      }
    ]
  }
]
```
*   `train_id` (string): Nomor perjalanan/ID unik kereta api.
*   `ka_name` (string): Nama jalur rute KRL (misal: COMMUTER LINE BOGOR).
*   `color` (string): Kode warna jalur rute komuter (HEX).
*   `stops` (array): Urutan stasiun pemberhentian kereta:
    *   `station_id` (string): Kode stasiun pemberhentian.
    *   `station_name` (string): Nama stasiun pemberhentian.
    *   `time_est` (string): Estimasi jam keberangkatan/tiba di stasiun (Format: `HH:MM:SS`).
    *   `transit_station` (boolean): Menunjukkan apakah stasiun tersebut merupakan stasiun transit/persilangan jalur.
    *   `transit` (array | string): Daftar warna garis rute transit yang terhubung di stasiun tersebut.

#### 4. Jadwal per Stasiun (`schedules_by_station_all.json`)
```json
{
  "AC": [
    {
      "train_id": "2200",
      "ka_name": "COMMUTER LINE TANJUNGPRIUK",
      "route_name": "JAKARTAKOTA-TANJUNGPRIUK",
      "dest": "TANJUNGPRIUK",
      "time_est": "05:07:30",
      "color": "#DD0067",
      "dest_time": "05:16:00"
    }
  ]
}
```
*   `train_id` (string): Nomor kereta.
*   `ka_name` (string): Jalur operasional KRL.
*   `route_name` (string): Rute perlintasan kereta (asal-tujuan).
*   `dest` (string): Stasiun akhir tujuan kereta.
*   `time_est` (string): Waktu perkiraan tiba/berangkat di stasiun ini.
*   `color` (string): Kode warna rute komuter.
*   `dest_time` (string): Waktu perkiraan sampai stasiun akhir tujuan.

---

### Dukung Project Ini (Donasi)
Jika dataset ini membantu riset, analisis, atau project Anda, silakan berikan dukungan melalui tautan donasi berikut:
*   **Saweria (Lokal/IDR):** [https://saweria.co/langitbirugm](https://saweria.co/langitbirugm)
*   **Ko-fi (Internasional/USD):** [https://ko-fi.com/langitbirugm](https://ko-fi.com/langitbirugm)

---
---

## 🇬🇧 English

### About This Dataset
This dataset provides a comprehensive look at the timetables, station metadata, routes, and passenger fare matrix for the **KRL Commuter Line** network operated by **PT Kereta Commuter Indonesia (KAI Commuter)**. The data spans three major transit areas in Indonesia:
1.  **Region I (Jabodetabek / Greater Jakarta Area)**
2.  **Merak Region (Banten Province)**
3.  **Region VI (Yogyakarta - Solo)**

This dataset is perfect for public transit optimization, urban spatial analytics, route planning algorithms, and developing mobile travel companions.

> [!NOTE]
> This data was synchronized and scraped directly from the official **kci.id** website on **July 1, 2026**.

---

### Folder & File Structure
This dataset is structured to facilitate quick analysis:

*   **`stations.json`**: List of all KRL Commuter Line stations and their active statuses.
*   **`meta.json`**: Sync metadata containing counts, timestamps, and API sources.
*   **`fares_all.json`**: Consolidated fare lookup matrix and station-to-station distances (in km).
*   **`schedules_by_train_all.json`**: Consolidated train routes and ordered stops.
*   **`schedules_by_station_all.json`**: Consolidated station timetables mapped using station codes as keys.
*   **`fares.zip`**: Archive containing individual station relation fare JSON files (format: `fares/<origin>-<destination>.json`).
*   **`schedules.zip`**: Archive containing individual schedule logs:
    *   `schedules/by-train/`: Ordered timetables by train ID (`<train_id>.json`).
    *   `schedules/by-station/`: Time tables mapped per station code (`<station_code>.json`).

---

### Data Schema & Dictionary

#### 1. `stations.json` (Stations Directory)
```json
[
  {
    "id": "AC",
    "name": "ANCOL",
    "groupWil": 0,
    "fgEnable": 1,
    "active": true
  }
]
```
*   `id` (string): Unique short station code (2-4 chars, e.g., MRI, YK, AC).
*   `name` (string): Full station name.
*   `groupWil` (integer): Geographic region code.
*   `fgEnable` (integer): Flag status (1 = active, 0 = inactive).
*   `active` (boolean): Flag representing whether the station is active.

#### 2. `fares_all.json` (Fare Matrix)
```json
[
  {
    "sta_code_from": "AC",
    "sta_name_from": "ANCOL",
    "sta_code_to": "BJD",
    "sta_name_to": "BOJONGGEDE",
    "fare": 6000,
    "distance": 46.512
  }
]
```
*   `sta_code_from` (string): Origin station code.
*   `sta_name_from` (string): Origin station name.
*   `sta_code_to` (string): Destination station code.
*   `sta_name_to` (string): Destination station name.
*   `fare` (integer): Fare price in Indonesian Rupiah (IDR).
*   `distance` (double): Distance traveled in kilometers (km).

#### 3. Train Timetables (`schedules_by_train_all.json`)
```json
[
  {
    "train_id": "1000",
    "ka_name": "COMMUTER LINE BOGOR",
    "color": "#E30A16",
    "stops": [
      {
        "station_id": "MRI",
        "station_name": "MANGGARAI",
        "time_est": "05:10:00",
        "transit_station": true,
        "transit": ["#0000ff", "#ff0000"]
      }
    ]
  }
]
```
*   `train_id` (string): Unique train service ID.
*   `ka_name` (string): Route/line name (e.g., COMMUTER LINE BOGOR).
*   `color` (string): Line color code (HEX representation).
*   `stops` (array): Sequential list of stops:
    *   `station_id` (string): Station code.
    *   `station_name` (string): Full station name.
    *   `time_est` (string): Estimated departure/arrival time (Format: `HH:MM:SS`).
    *   `transit_station` (boolean): Flag indicating whether this is a transit node.
    *   `transit` (array | string): List of line connection colors intersecting at this station.

#### 4. Station Timetables (`schedules_by_station_all.json`)
```json
{
  "AC": [
    {
      "train_id": "2200",
      "ka_name": "COMMUTER LINE TANJUNGPRIUK",
      "route_name": "JAKARTAKOTA-TANJUNGPRIUK",
      "dest": "TANJUNGPRIUK",
      "time_est": "05:07:30",
      "color": "#DD0067",
      "dest_time": "05:16:00"
    }
  ]
}
```
*   `train_id` (string): Train number.
*   `ka_name` (string): Train service line.
*   `route_name` (string): Origin-Destination route description.
*   `dest` (string): Terminus destination of the train.
*   `time_est` (string): Scheduled departure/arrival time at this station.
*   `color` (string): Line color HEX.
*   `dest_time` (string): Scheduled arrival time at the terminus station.

---

### Support This Project (Donate)
If this dataset has been helpful for your research, analysis, or projects, please consider donating:
*   **Saweria (Local/IDR):** [https://saweria.co/langitbirugm](https://saweria.co/langitbirugm)
*   **Ko-fi (International/USD):** [https://ko-fi.com/langitbirugm](https://ko-fi.com/langitbirugm)
