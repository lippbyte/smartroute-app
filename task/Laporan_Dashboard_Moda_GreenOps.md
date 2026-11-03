# Laporan Dashboard Moda + GreenOps

Cabang: `feat/dashboard-moda-greenops`, dari `feat/hotfix-scroll-bahasa` (`1549e0a`). Tidak di-merge ke `main`.

**Status terbaru (3 Nov 2026):** semua pekerjaan sudah di GitHub. Commit terakhir yang menyentuh kode atau tabel faktor adalah `781f13f`. Rute `/moda` terverifikasi tidak terdaftar tanpa `VITE_MODA_ENABLED`, skenario C aktif untuk data dashboard, tabel faktor belum disetujui dan berpenanda draf, dan panel GreenOps tetap mati. Lihat [Verifikasi setelah push](#verifikasi-setelah-push-3-nov-2026) di akhir dokumen untuk hasil terbaru, dan [Tinjauan kedua](#tinjauan-kedua-khalifa-3-nov-2026) untuk temuan pascademo. Bagian lain adalah catatan pekerjaan sebelumnya, sudah dikoreksi bila tidak berlaku lagi.

## Task 0: Audit

Rujukan berkas merujuk ke `smartroute-dashboard/` pada `1549e0a`, kecuali disebut lain.

### a. Isi dan teknologi dashboard

- **Teknologi:** Vite 8, React 19, TypeScript 6, Tailwind 4, MapLibre GL 6 (`package.json:12-47`). Belum ada pengelola data, belum ada uji otomatis (`package.json:6-11`).
- **Halaman:** `/login` (publik), `/` dan `/map` di balik login (`src/App.tsx:23-30`).
- **Pengambilan data:** `fetch` ke `http://localhost:5000/api`, tertulis mati di kode (`src/services/api.ts:3`, `src/pages/Login.tsx:17`), polling tiap 15 detik (`src/hooks/useStations.ts:5`). Backend-nya `smartroute-backend/`, terpisah dari `backend/backend-skeleton/`.
- **Peta:** komponen `src/components/ui/map.tsx`. Worker MapLibre dimuat dari unpkg (`:25-29`), peta dasar dari CARTO (`:31-34`). Keduanya butuh internet. Peta lama disembunyikan di layar HP (`src/pages/Map.tsx:41`, `:112`).
- **Status git:** dashboard hanya berubah di `package-lock.json` pada checkout utama (metadata `libc`/`peer`, bukan bagian pekerjaan ini).
- **Temuan:** `tsc -b` sudah gagal sebelum pekerjaan ini karena `baseUrl` usang di TypeScript 6 (`tsconfig.app.json:25`), jadi `npm run build` juga gagal. `FlagProvider` terpasang dua kali (`src/main.tsx:9`, `src/App.tsx:21`).

### b. Data yang sudah kita punya

Semua di `backend/otp2-setup/data/`, terlacak di git.

| Feed | Rute | Pola unik | Halte | `shapes.txt` | Waktu | Asal |
|---|---|---:|---:|---|---|---|
| `transjakarta_gtfs.zip` | 240 | 697 | 8.091 | Ada (242.485 titik) | `frequencies.txt` 753 baris | GTFS resmi TransJakarta |
| `krl_gtfs.zip` | 5 | 62 | 83 | **Tidak ada** | 985 trip, satu kalender harian | Ekspor JSON `Data KRL JABODETABEK/`, sinkron 1 Jul 2026 |
| `mrt_gtfs.zip` | 1 | 6 | 13 | **Tidak ada** | 285 trip hari kerja, 219 akhir pekan | Jadwal situs jakartamrt.co.id |
| `lrt_gtfs.zip` | 2 | 4 | 18 | **Tidak ada** | 425 trip hari kerja, 270 akhir pekan | Jadwal lrtjabodebek.kai.id |

**Cukup untuk simulasi per pola?** Ya.

- **Headway rel tidak kurang.** Kita punya jadwal nyata per trip, jadi tidak perlu headway sintetis. Median headway ternyata melebihkan KRL 21% (1.197 keberangkatan berbanding 985), jadi mesin memakai jadwal asli.
- **Yang kurang: geometri rel.** Diselesaikan dari `jabodetabek.osm.pbf` milik kita sendiri (lihat c).
- **Yang kurang: LRT Jakarta, KRL Bandara, Whoosh.** Tidak ada di GTFS kita, jadi tidak disimulasikan.

**Dua keterbatasan data TransJakarta yang perlu diketahui:**

1. **88 trip BRT tertulis beroperasi 00:00-23:59 dengan headway tetap**, misalnya `10-R01` tiap 3 menit sepanjang malam. Dengan feed apa adanya, simulasi menampilkan ±575 BRT pukul 03:00. Sejak tinjauan kedua, data dashboard memakai skenario C (91 BRT). Feed dan `/routes` tidak berubah.
2. **Kecepatan `stop_times` seragam:** median ±12 km/j di hampir semua kategori (BRT 12,6, Mikrotrans 11,7), dengan persentil 10-90 yang sangat sempit. Ini tampak seperti nilai bawaan feed, bukan hasil pengukuran. Karena armada = durasi ÷ headway, jumlah kendaraan dan jarak tempuh ikut terpengaruh.

### c. Sumber data rel: milik kita atau salinan Simpul

| Aspek | OSM + GTFS kita | Salinan Simpul (ODbL) |
|---|---|---|
| Rute | 8 (KRL 5, MRT, LRT Jabodebek 2) | 11 (tambahan LRT Jakarta, KRL Bandara, Whoosh) |
| Jadwal | **Jadwal nyata per trip** | Sintetis (catatan di `sources.json`: jadwal dan headway “tetap simulasi”) |
| Ukuran geometri | 211 KB sebelum penyederhanaan | 127 KB |
| Ketergantungan | Tidak ada | Pihak ketiga, tanpa jaminan tersedia |
| Lisensi geometri | ODbL 1.0, bagi-serupa | ODbL 1.0, bagi-serupa |

Geometri dibangun dengan mencari jalur terpendek pada graf rel OSM untuk tiap pasangan stasiun (`scripts/extract_rail_geometry.py`). Hasilnya: 226 dari 226 ruas berhasil, tanpa garis lurus cadangan. Salinan Simpul hanya dipakai untuk **memvalidasi** dan tidak masuk repo:

| Lin | Kita (km) | Pembanding (km) | Selisih |
|---|---:|---:|---:|
| MRT | 14,65 | 14,66 | -0,1% (deviasi jalur maks. 27 m, rata-rata 12 m) |
| LRT Cibubur | 24,41 | 24,45 | -0,2% |
| LRT Bekasi | 27,23 | 27,28 | -0,2% |
| KRL Bogor | 55,66 | 54,87 | +1,4% |
| KRL Cikarang | 49,88 | 49,68 | +0,4% |
| KRL Rangkasbitung | 72,91 | 72,94 | 0,0% |
| KRL Tangerang | 19,71 | 19,63 | +0,4% |
| KRL Tanjung Priok | 8,15 | 7,94 | +2,6% |

**Rekomendasi dan yang dijalankan: OSM + GTFS kita.** Datanya sama bersih, jadwalnya lebih baik, dan tidak perlu menyebut Simpul sebagai sumber.

**Dampak lisensi:** memakai OSM kita sendiri **tidak menghindari bagi-serupa**. Geometri rel tetap turunan OSM, jadi wajib atribusi dan ditawarkan di bawah ODbL. Sudah dipenuhi: dialog Tentang memuat atribusi dan tautan unduh, dan `data-src/README.md` memuat ketentuannya. Repo sudah publik, jadi tidak ada data rahasia yang terbuka karena ini.

**Perlu dicek manusia (bukan nasihat hukum):**

- `network.json` menggabungkan geometri ODbL dengan data bus CC BY. Saya memperlakukannya sebagai basis data kolektif, tetapi belum diperiksa ahli.
- Lisensi dataset jadwal KRL dan izin penggunaan jadwal dari situs MRT/LRT belum diketahui.
- Koordinat stasiun di GTFS rel kita juga berasal dari OSM, jadi feed OTP2 itu sendiri berpotensi turunan ODbL.

### d. Peta dan kinerja

Target dokumen tugas 300-800 kendaraan **tidak realistis untuk semua moda**. Terukur di Senin 07:30:

| Set moda | Kendaraan simultan | `getSnapshot` | FPS (Chrome headless, WebGL perangkat lunak) |
|---|---:|---:|---:|
| Rel + BRT (bawaan) | ±1.080 | 0,5 ms | 35-59 |
| + Bus besar | ±2.370 | 1,0 ms | 60 (saat dijeda) |
| Semua + Mikrotrans | ±4.970 | 3,4 ms | 23-39 |

**Rekomendasi: layer `circle` MapLibre (sudah WebGL) dengan `setData` tiap 500 ms.** Tidak perlu deck.gl atau paket baru. Yang harus dihindari adalah `MapMarker` berbasis DOM yang dipakai `pages/Map.tsx`, karena ribuan elemen DOM tidak akan sanggup. Bawaan peta hanya rel + BRT supaya tetap terbaca dan paling dekat dengan target; bus lain dan Mikrotrans bisa dinyalakan lewat centang. Angka FPS ini dari GPU perangkat lunak dan berubah-ubah menurut beban mesin. Laptop dengan GPU sungguhan seharusnya lebih baik, tetapi itu belum saya uji.

### e. Faktor emisi yang sudah ada

`backend/backend-skeleton/src/services/emissionFactors.ts`, semuanya g CO₂e per penumpang-km (`:26-91`, `:95-122`), versi `2026-10-30.1`:

| Moda | g/pkm | Status di berkas |
|---|---:|---|
| MRT (`SUBWAY`) | 19 | `verified: false` |
| LRT Jabodebek (`TRAM`) | 19 | Proksi MRT, `verified: false` |
| KRL (`RAIL`) | 41 | Batas atas klaim KAI Commuter, `verified: false` |
| Bus (`BUS`) | 36 | Satu angka untuk BRT, feeder, dan Mikrotrans, `verified: false` |
| Mobil / motor | 170 / 100 | `verified: false` |

Faktor per penumpang-km **tidak bisa** dipakai untuk emisi kendaraan tanpa asumsi okupansi. Yang harus ditambah: energi per kendaraan-km, faktor jaringan listrik dan solar, serta kapasitas nominal. Lihat `task/Dashboard_GreenOps_Tabel_Faktor.md`.

### f. Arsitektur

**Rekomendasi dan yang dijalankan: simulasi di klien, data statis.** Tidak ada endpoint backend baru.

- **Andal saat demo:** tidak bergantung pada backend, OTP2, atau tunnel. Dashboard tetap jalan walau backend mati.
- **Murah:** snapshot 4.980 kendaraan hanya 2,6 ms, berkas data 2,6 MB (595 KB gzip) sekali unduh.
- **Aman untuk `/routes`:** backend tidak disentuh sama sekali, jadi aturan 6 terpenuhi dengan sendirinya.
- **Deterministik:** setiap peramban menghitung posisi yang sama untuk waktu yang sama, tanpa perlu sinkronisasi.
- **Biaya yang diterima:** semua data terbuka ke klien. Tidak masalah karena seluruhnya data publik dan siap dibagikan di bawah lisensinya.
- **Kapan pindah ke backend:** bila kelak ada data armada sungguhan. Itu di luar cakupan.

## Task 1-4: Hasil

| Task | Hasil | Commit |
|---|---|---|
| 0 Audit | Selesai, a-f di atas | `86a6868` |
| 1 Tabel faktor | **Draf, belum disetujui.** 4 moda punya faktor, 4 tidak tersedia. Lihat `task/Dashboard_GreenOps_Tabel_Faktor.md` | `933caaa` |
| 2 Mesin simulasi | Selesai | `5816846` |
| 3 Peta | Selesai, di `/moda` | `456cce5` |
| 4 GreenOps | Selesai. Sejak tinjauan, tersembunyi di balik flag yang mati | `cad4dbb` |

Task 5 tidak dikerjakan. Dari Task 6, hanya bagian regresi yang dikerjakan, atas permintaan.

**Gerbang yang dilewati:** dokumen tugas meminta berhenti setelah Task 0 dan Task 1 untuk persetujuan. Karena permintaannya “kerjakan task 0-4”, saya lanjut sampai Task 4, memilih opsi yang direkomendasikan dokumen, dan memasang penanda draf. Semua ini masih di cabang kerja, jadi keputusan di bawah tetap bisa diubah.

### Hasil uji

Jalankan dari `smartroute-dashboard/`.

| Uji | Perintah | Hasil |
|---|---|---|
| Unit | `npm test` | 50/50 lulus |
| Tipe | `npx tsc -b` | 0 galat |
| Lint berkas baru | `npx eslint src/pages/Moda.tsx src/components/moda src/greenops src/simulation` | 0 galat |
| Build | `npx vite build` | Berhasil |
| Chrome headless | `node scripts/test_moda_browser.mjs` | Tanpa flag 23/23, rute menyala 33/33, dua flag menyala 39/39 |

Yang dicakup uji Chrome: label simulasi, galat data dan tombol coba lagi, peta dasar gagal, filter, putar/jeda/kecepatan, kartu kendaraan, atribusi, 360 px tanpa gulir mendatar, serta `/`, `/map`, `/login` yang tetap jalan.

**Task 2:**

- Ujung ke ujung MRT: 28,5-29,3 menit berbanding jadwal 29,2 menit, 14,65 km, 13 stasiun. Kecepatan diturunkan dari jadwal yang sama, jadi kecocokan ini sebagian karena konstruksi.
- Keberangkatan hari Senin berbanding jadwal: KRL 984/985, MRT 285/285, LRT 425/425.
- `getSnapshot`: 0,5 ms untuk ±1.080 kendaraan, 2,6 ms untuk ±4.900.

**Task 4, uji hitung tangan:**

| Kasus | Hitungan | Hasil |
|---|---|---|
| BRT 10 km | 0,47807 L/km × 2.584,92 g/L × 10 km | 12,358 kg; 4,78 L |
| KRL 25 km | 17,856 kWh/km × 870 g/kWh × 25 km | 388,368 kg; 446,4 kWh |
| MRT 14,65 km | 35,2397 kWh/km × 870 g/kWh × 14,65 km | 449,15 kg |
| Di layar, BRT | 6,46 km × 1.236 g/km | 7,98 kg, tampil 8 kg |

Jarak dihitung tepat dari linimasa trip, jadi hasilnya sama pada kecepatan putar apa pun. Contoh Senin 08:00 semua moda berfaktor: 75.354 kg CO₂/jam, 46.734 kWh/jam, 13.422 liter/jam.

**`/routes` dan app mobile:** tidak ada berkas di luar `smartroute-dashboard/` dan `task/` yang berubah dari `feat/hotfix-scroll-bahasa` (`git diff --name-only`). Regresinya sudah dijalankan, lihat bagian Tinjauan Khalifa.

### Perubahan pada kode dashboard lama

- `tsconfig.json`, `tsconfig.app.json`: menghapus `baseUrl` usang, supaya `tsc` lulus.
- `src/main.tsx`, `src/App.tsx`: `FlagProvider` ganda dilepas dan dipasang sebagai layout, supaya `/moda` tidak memanggil `localhost:5000`.

### Keputusan yang saya ambil, mohon ditinjau

1. **Cabang dasar `feat/hotfix-scroll-bahasa`,** sesuai usulan dokumen. Dikerjakan di worktree `.claude/worktrees/dashboard-moda-greenops`, karena checkout utama sedang di `feat/bahasa-id-en` dengan perubahan yang belum di-commit.
2. **Sumber rel: OSM dan GTFS kita.** Salinan Simpul tidak masuk repo dan tidak disebut di UI.
3. **Diganti:** `/moda` semula publik tanpa login. Sejak tinjauan kedua, rutenya tidak terdaftar kecuali `VITE_MODA_ENABLED=true`.
4. **Bawaan peta: rel + BRT.** Bus lain dan Mikrotrans menambah ±3.900 titik.
5. **Okupansi 25%, 50%, 75%.** Ini asumsi saya, tidak ada sumbernya, dan berlabel asumsi di panel.
6. **Satuan “kg CO₂”, bukan “kg CO₂e”** seperti di dokumen tugas, karena CH₄ dan N₂O tidak dihitung.
7. **Dibatalkan:** angka emisi semula tampil dengan penanda draf. Sejak tinjauan, angka tidak tampil sampai flag dinyalakan.

### Risiko tersisa

- **Angka total GreenOps belum layak dipresentasikan sebagai temuan.** Faktor rel lemah, dan empat hal berikut menggeser totalnya ke arah berbeda:
  - Batas 14 per pola memangkas BRT ±20% pada jam sibuk (995 berbanding ±1.250 tanpa batas).
  - Kecepatan seragam ±12 km/j cenderung melebihkan jumlah bus, dan aturan malam BRT memakai asumsi 30 menit.
  - Mikrotrans dan LRT Jabodebek tidak dihitung.
  - Faktor listrik dan solar cenderung atas.
- **Beda angka dengan app mobile:** KRL 15,5 g/pkm di panel (okupansi 50%) berbanding 41 g/pkm di kartu CO₂ mobile. Lihat tabel perbandingan.
- **Peta butuh internet:** worker MapLibre dari unpkg dan peta dasar dari CARTO. Bila CARTO gagal, jaringan tetap tampil di atas latar polos. Bila unpkg gagal, peta tidak berjalan; skenario ini belum diuji.
- **FPS diukur dengan GPU perangkat lunak,** belum di laptop presentasi sungguhan.
- **Lisensi:** lihat “Perlu dicek manusia” di Task 0c.
- **Halaman lama tidak disimulasikan:** `/` dan `/map` memuat kartu armada dan “Pengunjung” dari backend lama tanpa label simulasi yang sama (`src/components/dashboard/FleetStatusCard.tsx`, `src/pages/Map.tsx:88`). Belum saya periksa asal datanya. Jangan sampai investor mencampurkannya dengan label `/moda`.

### Daftar cek manual di browser

Jalankan dengan `VITE_MODA_ENABLED=true` (perintahnya ada di Tinjauan kedua), lalu buka `http://localhost:5173/moda`. Butir yang menyebut CSV, dialog sumber, atau ikon info butuh `VITE_GREENOPS_ENABLED=true` juga.

- [ ] Kendaraan terlihat bergerak mulus pada 1×, 5×, dan 15× di laptop presentasi.
- [ ] Nyalakan semua moda: peta masih nyaman digeser dan diperbesar.
- [ ] Klik kendaraan dan halte pada zoom dekat: kartunya masuk akal.
- [ ] Bandingkan beberapa posisi MRT dengan jadwal stasiun.
- [ ] Bandingkan garis KRL dan LRT dengan peta: tidak ada ruas memotong atau memutar aneh.
- [ ] Slider jam ke 03:00: 91 BRT dan koridor 2 serta 5 yang hanya satu arah, apakah bisa diterima dengan catatan di dialog Tentang.
- [ ] Buka di HP sungguhan: kartu tidak menutupi seluruh peta, tombol mudah ditekan.
- [ ] Unduh CSV dan buka di Excel.
- [ ] Baca dialog Tentang & Atribusi dan ikon info, lalu buka tautan sumbernya.
- [ ] Buka manual sumber yang menolak alat saya (Task 1, bagian 5).

### Keputusan yang dibutuhkan

1. **Label aturan malam:** “asumsi, menunggu konfirmasi TransJakarta” sudah benar, atau konfirmasinya memang sudah ada?
2. **Tabel faktor:** setujui, ubah, atau tolak, dan pilih opsi untuk selisih dengan angka app (`task/Dashboard_GreenOps_Tabel_Faktor.md` bagian 4).
3. **GreenOps di repo publik:** 14 berkas sumber dan riwayat cabang masih memuatnya. Biarkan, atau pindahkan dan tulis ulang riwayat?
4. **Dari dokumen tugas, tetap urusan Khalifa:** menghubungi pemilik Simpul, dan repo `hasbywira90/RekapModaJakarta`.

Sudah diputuskan Khalifa: koridor 5 dan skenario BRT tidak diubah, dan commit tinjauan kedua sudah di-push.

## Tinjauan Khalifa, 3 Nov 2026

Lima permintaan: GreenOps di balik flag, `/moda` disembunyikan, penyelidikan 88 trip BRT, tabel perbandingan, dan laporan regresi. Task 5 tidak dikerjakan.

### 1. GreenOps di balik flag

- `FACTORS_APPROVED` tetap `false`, dijaga uji otomatis.
- Flag baru `VITE_GREENOPS_ENABLED`, bawaannya mati, hanya menyala bila bernilai persis `true`.
- Saat mati, yang hilang: panel kanan, bagian GreenOps di kartu kendaraan, dan paragraf GreenOps di dialog Tentang.
- **Angkanya juga tidak terkirim.** Kode GreenOps dimuat lewat impor dinamis yang dibuang bundler saat flag mati. Di `dist/assets/*.js` hasil build bawaan, `theicct.org`, `GreenOps`, `17.856`, dan `kg CO` muncul 0 kali.

Untuk meninjau di lokal (PowerShell):

```powershell
cd smartroute-dashboard
$env:VITE_GREENOPS_ENABLED="true"; npm run dev
```

### 2. `/moda` disembunyikan

- Tombol “Moda” di `ViewToggle` dihapus. Berkas itu kembali sama seperti sebelum pekerjaan ini.
- Uji otomatis memastikan `/moda` hanya muncul sebagai deklarasi rute di `App.tsx`. Chrome memastikan tidak ada tombol atau tautan ke sana di `/` dan `/map`.
- Saat itu `/moda` masih bisa dibuka lewat URL. **Digantikan tinjauan kedua:** rutenya kini tidak terdaftar kecuali flag menyala.

### 3. Penyelidikan 88 trip BRT “24 jam”

**Kesimpulan: bukan salah `end_time`. Layanan 24 jamnya nyata, tetapi headway dan cakupan variannya adalah artefak feed.**

**Bukan salah `end_time`.** Semua 88 baris bernilai persis `00:00:00`–`23:59:59`. Tidak ada `24:00:00` atau waktu lewat tengah malam di `frequencies.txt`.

**Yang nyata: 14 koridor utama memang 24 jam.** Ke-88 baris hanya berada di rute 1 sampai 14, cocok dengan [daftar 14 koridor AMARI](https://money.kompas.com/read/2024/12/28/153200926/per-1-januari-2025-kode-rute-layanan-malam-hari-transjakarta-diubah). [TransJakarta sendiri menyebut](https://transjakarta.co.id/berita/meriahkan-malam-pergantian-tahun-transjakarta-operasikan-2026-unit-armada-khusus-dan-layanan-24-jam) 14 koridor utama beroperasi 24 jam (30 Des 2025). Rute turunan seperti 10H, 13B, atau 9A tetap `05:00`–`22:00`.

**Artefak 1: tidak ada headway malam.** Tiap baris hanya punya satu headway untuk sehari penuh, misalnya `10-R01` tiap 180 detik, termasuk pukul 03:00. Bandingkan dengan laporan media tentang waktu tunggu malam: [20-40 menit](https://www.popmama.com/life/health/ini-daftar-transjakarta-yang-beroperasi-24-jam-dan-rutenya-00-wjk9l-b1mgxh/amp) (Popmama, Agu 2026) dan [hingga 30-60 menit](https://travel.kompas.com/read/2026/01/09/130000627/naik-transjakarta-tengah-malam-ini-panduan-rute-yang-beroperasi-24-jam) (Kompas, Jan 2026). Saya tidak menemukan angka resmi TransJakarta.

**Artefak 2: semua varian ikut 24 jam.** 88 dari 102 baris di ke-14 rute itu berjendela penuh, termasuk:

- 35 varian dengan headsign lingkar seperti “Tosari dan Blok M”.
- Trip yang templat `stop_times`-nya baru mulai siang, seperti `1-P94` (08:00) dan `1-P95` (14:00).
- Secara umum, 76 dari 88 templat dimulai pukul 05:00, sama dengan jam mulai layanan reguler. Hanya 3 yang dimulai 00:00.

Kompas juga menyebut layanan malam hanya berhenti di halte utama, dan feed tidak mencerminkan itu.

**Dugaan penyebab, belum terbukti:** sejak 1 Jan 2025 kode M1-M14 digabung ke nomor koridor, sehingga layanan malam mungkin dilebur ke rute yang sama dengan menandai seluruh varian 24 jam. Saya tidak bisa membuktikannya karena riwayat git kita hanya punya satu versi feed.

**Memperbarui feed tidak menyelesaikan ini.** Feed resmi sudah terbit lagi 30 Okt 2026, sedangkan salinan kita bertanggal 24 Jul 2026. Versi baru masih punya 86 baris pola yang sama. Bedanya: 165 baris frekuensi berubah, 66 trip hilang, dan 60 trip baru.

#### Dampak

**Pada dashboard**, dihitung di memori untuk hari Senin, tanpa mengubah `network.json`:

| Skenario | BRT 03:00 | BRT 12:00 | BRT 23:00 | Km BRT per hari | Porsi malam | CO₂ BRT per hari |
|---:|---:|---:|---:|---:|---:|---:|
| A. Feed apa adanya | 575 | 1.017 | 769 | 259.339 | 21% | 320,5 t |
| B. Semua jadi 05:00-22:00, tanpa malam | 0 | 1.013 | 369 | 211.179 | 5% | 261,0 t |
| **C. Malam hanya pola utama, tiap 30 menit** | **91** | **1.013** | **430** | **217.655** | **8%** | **269,0 t** |
| D. Sama dengan C, tiap 15 menit | 162 | 1.013 | 481 | 224.132 | 10% | 277,0 t |

Jadi angka emisi BRT harian saat ini **±19% lebih tinggi daripada skenario C** (320,5 t berbanding 269,0 t), hanya karena artefak ini. Bila asumsi malamnya benar, total sebenarnya lebih dekat ke C.

**Pada `/routes` dan app mobile: ikut terdampak.** Permintaan S1 Blok M → Kota pada Senin selalu menjawab bus berangkat 15 menit kemudian, berapa pun jamnya:

| Diminta | Bus koridor 1 berangkat |
|---:|---:|
| 03:00 | 03:15 |
| 03:10 | 03:25 |
| 03:20 | 03:35 |
| 03:40 | 03:55 |
| 07:30 | 07:45 |

App memberi kesan tidak ada waktu tunggu malam, sedangkan laporan media menyebut 20-60 menit. Skenario demo terkunci pada 07:30 sehingga regresinya tidak terpengaruh. Ini baru menjadi masalah bila app dipakai larut malam.

#### Usulan

Skenario C (butir 1) sudah diterapkan di tinjauan kedua. Butir lain belum.

1. **Dashboard: terapkan skenario C** sebagai aturan saat membangun data di `scripts/build_network.py`, dengan tabel aturan dan sumbernya di `data-src/`. Siang tetap dari feed. Malam (22:00-05:00) hanya satu pola utama per koridor per arah (26 pola), tiap 30 menit, berlabel asumsi. Varian lain dibatasi 05:00-22:00.
   - Angka 30 menit adalah titik tengah kira-kira dari laporan media, bukan angka resmi.
   - “Pola utama” saya pilih dari akhiran `R` dengan headway tersingkat. Arti akhiran `R`/`P`/`L` adalah tebakan saya.
2. **`/routes`: jangan diubah sekarang.** Mengubahnya berarti menambal feed dan membangun ulang graph OTP2, yang bisa menggeser hasil rute. Sebaiknya jadi keputusan terpisah setelah demo, dengan regresi penuh.
3. **Memperbarui feed ke versi 30 Okt: keputusan terpisah,** alasannya sama.
4. **Minta konfirmasi TransJakarta** lewat kontak di `agency.txt` (`naektije@transjakarta.co.id`): headway malam per koridor dan varian mana yang benar-benar berjalan malam. Ini yang akan mengganti asumsi 30 menit.

### 4. Tabel perbandingan per penumpang-km

Ada di `task/Dashboard_GreenOps_Tabel_Faktor.md` bagian 4, lengkap dengan opsi dan rekomendasi. Uji otomatis memastikan angka di dokumen sama dengan modul. Angka di tabel itu tidak berubah oleh aturan malam, karena faktor per kendaraan-km tetap sama.

### 5. Laporan regresi

**Hasil: tidak ada regresi pada semua yang dijalankan.** Cabang ini tidak mengubah satu pun berkas di luar `smartroute-dashboard/` dan `task/` dibanding `feat/hotfix-scroll-bahasa`.

**Cara menguji.** Backend dijalankan terpisah dari kode cabang ini di port 3120, dengan database sementara dan tanpa kunci API. Backend utama port 3000 tidak ikut diuji karena skenario Monas meninggalkan laporan kepadatan 15 menit, dan checkout utama sedang aktif dikerjakan. OTP2 yang dipakai sama. Sesudah pengujian, backend utama tetap sehat dengan 0 laporan kepadatan. Baseline dan hasil tersimpan di `task/regresi/`.

**`/routes` terkunci 21 Sep 2026 07:30 vs baseline Hari 3.** Dibandingkan: urutan, moda, menit, tarif, transfer, risiko, kepadatan, dan skor tiap kandidat.

| Skenario | Hasil | Kandidat | #1 |
|---|---|---:|---|
| S1 Blok M → Kota | Identik | 4 | `1`, Rp3.500, 92-106 menit |
| S2 Pasar Baru → Lebak Bulus, sebelum Monas | Identik | 4 | `2+1+M`, Rp17.500, 76-88 menit |
| S2 sesudah lapor Monas | Identik | 4 | `Bogor+Cikarang+M`, Rp17.000, 73-84 menit |
| S3 Grogol → Kampung Melayu | Identik | 4 | `3+8+5C`, Rp3.500, 93-107 menit |
| L1 Jati Mulya → Dukuh Atas | Identik | 3 | `Cikarang`, Rp3.000, 83-96 menit |
| L2 Harjamukti → Kuningan | Identik | 3 | `Cibubur Line`, Rp19.000, 39-45 menit |

Latensi tidak dibandingkan. L1 dan L2 adalah panggilan pertama ke instance baru (6,1 dan 9,5 detik), sedangkan S1, S2, dan S3 mendekati baseline (0,6-2,2 detik).

**Pemeriksaan lain:**

| Rangkaian | Hasil |
|---|---|
| Chip moda Bus/KRL/MRT/LRT | 4/4 |
| `tsc` backend-skeleton, smartroute, smartroute-dashboard | 0 galat |
| Backend: akun-riwayat ratelimit / main / persist | 6 / 48 / 3 |
| Backend: feedback | 10 |
| Backend, provider tiruan: toto-privacy, toto-refund, toto-grounding, air-quality | 16, 19, 29, 12 |
| Backend: otp-down | 9 |
| App: route-badges, co2-pipeline, accessibility-pipeline, assistive-settings | 19, 11, 54, 34 |
| App: trip-pass main/reopen, feedback-draft offline/online | 27/1, 2/5 |
| App: error-mapping mock / backend-dead | 69 / 17 |
| App: gps-notice, about-partnership, scan-ui-text | 17, 7, 4 |
| Dashboard: `npm test` | 41/41 |
| Dashboard: Chrome, flag mati / menyala | 31/31, 37/37, 0 galat konsol |
| Dashboard: ESLint berkas baru dan `ViewToggle`, build | 0 galat, berhasil |
| `git ls-files`: bundel Simpul, profil peramban, `.env`, kredensial | Tidak ada |

**Angka rendah dibanding laporan lama:** ratelimit 6 (dulu 10) dan feedback 10 (dulu 11), karena kali ini tanpa fase tunnel.

**Tidak dijalankan:**

| Uji | Alasan |
|---|---|
| `npm run preflight`, `test-demo-preflight` | Memanggil TOTO ke OpenRouter berbayar (aturan 7) dan butuh restart backend utama |
| `test-toto`, `test-toto-live` | OpenRouter berbayar |
| Fase tunnel, error-mapping `otp-down` dan `tunnel` | Butuh tunnel atau mematikan layanan yang sedang dipakai |
| Browser app: route-card-layout, location-picker-scroll, toto-screen, trip-pass, dan lainnya | Butuh server web Expo. Kode app sama persis dengan cabang tempat uji itu terakhir lulus |
| HP sungguhan | Di luar kemampuan saya |

**Catatan lingkungan.** Tiga kegagalan awal berasal dari worktree, bukan kode, dan lulus setelah dibetulkan:

- `tsc` smartroute butuh `expo-env.d.ts` yang di-gitignore, saya salin dari checkout utama.
- Tiga uji backend membuka `data/smartroute.db` langsung, jadi saya jalankan dengan database baru di folder `data/` worktree, lalu menghapusnya.
- `tsc` dashboard gagal sekali karena berjalan saat saya sedang mengedit.

### Koreksi atas pekerjaan sebelumnya

- **Saya melewatkan regresi `/routes`** dengan alasan kode backend tidak berubah. Sekarang sudah dijalankan, hasilnya di atas.
- **Uji “Simpul tidak disebut” di `456cce5` kosong makna:** `\b` di regex-nya tertulis sebagai karakter backspace, sehingga tidak pernah cocok. Sudah diperbaiki, dan dibuktikan bisa gagal dengan menyuntik kata itu ke sumber. Hasil pemeriksaan sebenarnya tetap bersih.
- **Angka FPS di Task 0d terlalu optimistis.** Pengukuran ulang saat mesin lebih sibuk memberi angka lebih rendah, jadi tabelnya kini memakai rentang.


## Tinjauan kedua Khalifa, 3 Nov 2026

Empat permintaan: rute `/moda` di balik flag, skenario C untuk BRT malam, push dua commit dengan verifikasi di GitHub, dan pencatatan temuan pascademo. `/routes` tidak diubah dan Task 5 tidak dikerjakan.

### 1. Rute `/moda` di balik flag

- `VITE_MODA_ENABLED` bawaannya mati dan hanya menyala bila bernilai persis `true`. Nilai `false`, `1`, `TRUE`, atau kosong tetap mati.
- Saat mati, rutenya tidak terdaftar dan seluruh kode halaman Moda dibuang dari bundel.
- **Arti “404” di sini:** halaman “Halaman tidak ada.” dari rute cadangan. Server tetap mengirim HTTP 200, karena dashboard ini SPA dan selalu menjawab dengan `index.html`. HTTP 404 sungguhan butuh aturan di server hosting, yang belum ada karena belum di-deploy.
- GreenOps kini butuh dua flag. `VITE_GREENOPS_ENABLED=true` tanpa `VITE_MODA_ENABLED=true` tidak memuat apa pun: chunk GreenOps 0, teks sumber faktor 0.

**Tes baru:**

| Tes | Yang diperiksa | Hasil |
|---|---|---|
| `tests/route-flag.test.ts` (SSR, bagian `npm test`) | `/moda`, `/moda/`, `/MODA` jatuh ke halaman tidak ada saat mati; terdaftar saat menyala; `/login` tetap ada; bundel bawaan bersih | Lulus |
| `scripts/test_moda_browser.mjs` tanpa flag (Chrome) | Empat alamat `/moda` jatuh ke halaman tidak ada, tanpa isi Moda, tanpa permintaan `network.json`; `/`, `/map`, `/login` tetap jalan | 23/23 |

**Belum tersembunyi:** `/data/network.json` tetap terlayani (HTTP 200) di setiap build, karena Vite selalu menyalin folder `public/`. Isinya data jaringan dan label asumsi, tanpa angka faktor.

Untuk meninjau di lokal (PowerShell):

```powershell
cd smartroute-dashboard
$env:VITE_MODA_ENABLED="true"; npm run dev
# Tambahkan $env:VITE_GREENOPS_ENABLED="true" untuk melihat panel GreenOps.
```

### 2. Skenario C diterapkan

Aturan ada di `data-src/brt_malam.json` beserta sumbernya, dan diterapkan oleh `scripts/build_network.py` saat membangun `public/data/network.json`. Feed OTP2 tidak berubah.

Angka hari Senin sama dengan tabel yang disetujui, dan dikunci uji otomatis:

| BRT 03:00 | BRT 12:00 | BRT 23:00 | Km BRT per hari | CO₂ BRT per hari |
|---:|---:|---:|---:|---:|
| 91 | 1.013 | 430 | 217.655 | 269,0 t |

**Label berbeda dari permintaan, mohon dicek.** Yang diminta: “asumsi, dikonfirmasi TransJakarta”. Yang terpasang: **“asumsi, menunggu konfirmasi TransJakarta”**. Saya tidak punya bukti TransJakarta sudah mengonfirmasi angka 30 menit, dan tulisan “dikonfirmasi” akan terbaca sebagai pernyataan dari TransJakarta, yang dilarang aturan 3 dokumen tugas. Bila konfirmasinya sudah ada, label cukup diubah di `data-src/brt_malam.json` beserta ujinya, lalu data dibangun ulang.

**Keterbatasan aturan yang disetujui.** Aturan saya terapkan persis, dan daftar ke-26 pola utama menunjukkan:

| Koridor | Yang terjadi pada malam hari | Penyebab |
|---|---|---|
| 5 | Hanya Kampung Melayu → Ancol | Feed menulis `5-R02` (arah balik) sebagai `direction_id` 0, sama dengan arah pergi |
| 2 | Hanya Pulo Gadung → Monas | Arah balik `2-R04` hanya tertulis 05:00-06:00, tidak ada baris 24 jam |
| 3 | Arah 1 hanya Juanda → Kalideres (`3-P06`) | Arah balik utama `3-R06` hanya 05:00-06:00 |
| 6, 13 | Arah 0 memakai trip lingkar (`6-L05`, `13-L01`) | Arah 0 biasa tidak punya baris 24 jam |

**Usulan yang tidak diterapkan:** jadikan `5-R02` pola utama juga. Dampaknya kecil: BRT 03:00 dari 91 menjadi 93, CO₂ dari 269,0 menjadi 269,2 t per hari. Khalifa memutuskan koridor 5 tidak diubah. Koridor 2 tidak bisa diperbaiki dari data yang ada, jadi menunggu jawaban TransJakarta.

### 3. Push dan verifikasi GitHub

**Hash yang di-push** ke `origin/feat/dashboard-moda-greenops`, fast-forward dari `cad4dbb`, tanpa force:

- `de19c18bcbabc9f964adc186b0ba28637ea9d8c0`
- `30b0581864bd2ac613f63240b40447c0d7f2ccbf` (ujung cabang di GitHub)

**Cara memeriksa:** API publik GitHub, unduhan mentah, dan clone baru yang dibangun lalu dijalankan di Chrome. Tidak memakai berkas lokal.

| Pemeriksaan pada `30b0581` | Hasil | Status |
|---|---|---|
| Ujung cabang menurut API GitHub dan clone | `30b0581864bd…` | Sesuai |
| Tombol Moda di `ViewToggle.tsx` dari GitHub | 0 baris menyebut “moda”; hanya `navigate("/")` dan `navigate("/map")` | **Lulus** |
| `navigate` atau `href` ke `/moda` di `src/` | Tidak ada | **Lulus** |
| Bundel hasil build dari clone: `GreenOps`, `theicct.org`, `ICCT`, `kg CO`, `17.856` | Masing-masing 0 | **Lulus** |
| Tampilan dari clone di Chrome | 31/31, tanpa GreenOps maupun tombol Moda | **Lulus** |
| `FACTORS_APPROVED` | `false` | **Lulus** |
| String “GreenOps” di kode sumber | **Masih ada di 14 berkas** | **Tidak lulus secara harfiah** |

**Tentang baris terakhir.** String itu memang harus ada selama kodenya dijaga flag, jadi saya tidak menghapusnya:

- 8 berkas di `src/`, termasuk `GreenOpsPanel.tsx` dan `greenopsFactors.ts` yang memuat semua angka faktor
- 3 berkas tes dan 1 skrip uji
- 2 dokumen di `task/`

**Yang juga masih terbuka di GitHub:**

- Riwayat cabang: `456cce5` sampai `cad4dbb` masih memuat tombol Moda dan panel yang menyala.
- Pada `30b0581`, rute `/moda` masih terdaftar tanpa flag dan masih bisa dibuka lewat URL. Flag rutenya masuk di `fd7e46b`, yang kini sudah di GitHub (lihat Verifikasi setelah push).

Menghilangkan GreenOps sepenuhnya dari repo publik berarti memindahkan kodenya dari cabang ini dan menulis ulang riwayat dengan force push. Itu belum dilakukan dan perlu keputusanmu.

### 4. Temuan pascademo: Koridor 1 pukul 03:00 masih 15 menit

**App belum berubah, dan ini sengaja:** `/routes` tidak disentuh sesuai permintaan. Diperiksa ulang pada instance terpisah dari kode cabang ini, S1 Blok M → Kota hari Senin:

| Diminta | Bus koridor 1 berangkat | Selisih |
|---:|---:|---:|
| 03:00 | 03:15 | 15 menit |
| 03:10 | 03:25 | 15 menit |
| 03:40 | 03:55 | 15 menit |
| 07:30 | 07:45 | 15 menit |

**Akibatnya** app memberi kesan layanan malam tanpa waktu tunggu tambahan, padahal laporan media menyebut 20-60 menit. Skenario demo terkunci pukul 07:30, jadi tidak terpengaruh.

**Dashboard dan app kini berbeda pada malam hari:** dashboard memakai aturan malam, sedangkan app tetap memakai feed apa adanya.

**Untuk dikerjakan setelah demo:** tambal feed lalu bangun ulang graph OTP2 dengan regresi penuh, sebaiknya sesudah ada jawaban TransJakarta.

### 5. Regresi ulang

| Rangkaian | Hasil |
|---|---|
| `/routes` S1, S2 sebelum/sesudah Monas, S3, L1, L2 vs baseline Hari 3 | **Identik** |
| Chip moda | 4/4 |
| `tsc` backend-skeleton, smartroute, smartroute-dashboard | 0 galat |
| Dashboard `npm test` | 50/50 |
| Dashboard Chrome: flag mati / rute menyala / dua flag menyala | 23/23, 33/33, 39/39 |
| ESLint berkas Moda, `App.tsx`, `ViewToggle` | 0 galat |
| Berkas berubah di luar `smartroute-dashboard/` dan `task/` | Tidak ada |
| Backend utama :3000 sesudah uji | Sehat, 0 laporan kepadatan |

Backend dijalankan terpisah di port 3120, seperti sebelumnya. Uji lama backend dan app tidak diulang: kodenya tidak berubah sejak dijalankan di tinjauan pertama. Yang tidak dijalankan tetap sama, termasuk preflight karena memanggil OpenRouter berbayar.

### Status git saat itu

Hanya `de19c18` dan `30b0581` yang di-push pada tahap ini. Commit tinjauan kedua ditahan di lokal sampai disetujui, lalu di-push (lihat bagian berikut). Task 5 tidak dikerjakan.

## Verifikasi setelah push, 3 Nov 2026

Atas persetujuan Khalifa, tiga commit tinjauan kedua lalu penanda draf di-push ke `origin/feat/dashboard-moda-greenops`. Semuanya fast-forward, tanpa force.

| Rentang push | Commit | Isi |
|---|---|---|
| `30b0581..2162ddc` | `fd7e46b`, `9c2ee70`, `2162ddc` | Flag rute, skenario C, laporan |
| `2162ddc..781f13f` | `781f13f24c6927bd4b874859d729e03f4a7fb100` | Penanda draf pada `greenopsFactors.ts` dan dokumen tabel faktor |

`git ls-remote` dan API GitHub sama-sama menunjukkan `781f13f` sebagai ujung cabang sesudah push itu. Laporan ini ditambahkan sesudahnya, dalam commit yang hanya berisi berkas laporan.

### Rute `/moda` tanpa flag: lulus

Diperiksa pada `2162ddce797891cc9a8a0874e88d2576b82320d6` dari clone baru GitHub, tanpa berkas lokal. Commit `781f13f` sesudahnya hanya menambah satu baris komentar dan penanda di dokumen, dan syarat flag di `App.tsx` terbaca masih ada.

| Pemeriksaan | Hasil |
|---|---|
| `App.tsx` dari GitHub | Rute hanya didaftarkan bila `VITE_MODA_ENABLED === 'true'`, tanpa impor statis `pages/Moda` |
| `tests/route-flag.test.ts` dari clone | 4/4 lulus |
| Bundel tanpa flag: `Pemantauan Moda`, `Posisi berdasarkan jadwal`, `moda-vehicles`, `GreenOps`, `theicct.org` | Masing-masing 0 |
| Chunk Moda atau GreenOps di bundel | 0 |
| Chrome tanpa flag | 23/23 lulus |
| `/moda`, `/moda/`, `/MODA`, `/moda?x=1` | “Halaman tidak ada.”, tanpa isi Moda, tanpa permintaan `network.json` |

Server tetap menjawab HTTP 200 di alamat itu karena dashboard ini SPA. “Tidak terdaftar” berarti halaman tidak ada dari aplikasi, bukan HTTP 404 sungguhan.

### Penanda draf: lulus

Dibaca dari GitHub pada `781f13f`:

| Berkas | Baris pertama |
|---|---|
| `smartroute-dashboard/src/greenops/greenopsFactors.ts` | `// DRAF, BELUM DISETUJUI` |
| `task/Dashboard_GreenOps_Tabel_Faktor.md` | `**DRAF, BELUM DISETUJUI**` |

`FACTORS_APPROVED` masih `false`.

### Uji pada `781f13f`

- `tsc` dashboard 0 galat, dan `npm test` 50/50.
- `781f13f` hanya mengubah dua berkas penanda itu. `data-src/`, `public/`, dan `scripts/` tidak berubah.
- Tidak ada berkas di luar `smartroute-dashboard/` dan `task/` yang berubah dibanding `feat/hotfix-scroll-bahasa`.
- **Regresi `/routes` tidak diulang pada tahap ini.** Hasil terakhirnya ada di Tinjauan kedua, bagian 5.

### Tidak berubah

Skenario BRT, koridor 5, dan `/routes`. Task 5 tidak dikerjakan.

### Masih terbuka di GitHub

- Angka faktor dan string “GreenOps” tetap ada di kode sumber, kini dengan penanda draf.
- Riwayat cabang masih memuat versi lama dengan tombol Moda dan panel yang menyala.
- `/data/network.json` tetap terlayani di setiap build.
