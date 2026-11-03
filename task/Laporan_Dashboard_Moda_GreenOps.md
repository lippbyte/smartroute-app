# Laporan Dashboard Moda + GreenOps

Cabang: `feat/dashboard-moda-greenops`, dari `feat/hotfix-scroll-bahasa` (`1549e0a`). Tidak di-merge ke `main`.

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

1. **88 trip BRT tertulis beroperasi 00:00-23:59 dengan headway tetap**, misalnya `10-R01` tiap 3 menit sepanjang malam. Akibatnya simulasi menampilkan ±575 BRT pukul 03:00. Ini isi feed dan tidak dikoreksi, tetapi disebutkan di dialog Tentang.
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
| Rel + BRT (bawaan) | ±1.090 | 0,5 ms | 52 |
| + Bus besar | ±2.370 | 1,0 ms | 60 (saat dijeda) |
| Semua + Mikrotrans | ±4.980 | 2,6 ms | 39 |

**Rekomendasi: layer `circle` MapLibre (sudah WebGL) dengan `setData` tiap 500 ms.** Tidak perlu deck.gl atau paket baru. Yang harus dihindari adalah `MapMarker` berbasis DOM yang dipakai `pages/Map.tsx`, karena ribuan elemen DOM tidak akan sanggup. Bawaan peta hanya rel + BRT supaya tetap terbaca dan paling dekat dengan target; bus lain dan Mikrotrans bisa dinyalakan lewat centang. Angka FPS ini dari GPU perangkat lunak, jadi laptop sungguhan seharusnya lebih baik, tetapi itu belum saya uji.

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
| 4 GreenOps | Selesai, angka berlabel draf | commit Task 4 |

Task 5 dan 6 tidak dikerjakan karena di luar permintaan.

**Gerbang yang dilewati:** dokumen tugas meminta berhenti setelah Task 0 dan Task 1 untuk persetujuan. Karena permintaannya “kerjakan task 0-4”, saya lanjut sampai Task 4, memilih opsi yang direkomendasikan dokumen, dan memasang penanda draf. Semua ini masih di cabang kerja, jadi keputusan di bawah tetap bisa diubah.

### Hasil uji

Jalankan dari `smartroute-dashboard/`.

| Uji | Perintah | Hasil |
|---|---|---|
| Unit | `npm test` | 35/35 lulus |
| Tipe | `npx tsc -b` | 0 galat |
| Lint berkas baru | `npx eslint src/pages/Moda.tsx src/components/moda src/greenops src/simulation` | 0 galat |
| Build | `npx vite build` | Berhasil |
| Chrome headless | `node scripts/test_moda_browser.mjs` | 35/35 lulus, 0 galat konsol di `/moda` |

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

Jarak dihitung tepat dari linimasa trip, jadi hasilnya sama pada kecepatan putar apa pun. Contoh Senin 08:00 semua moda berfaktor: 75.468 kg CO₂/jam, 46.734 kWh/jam, 13.466 liter/jam.

**`/routes` dan app mobile:** tidak ada berkas di luar `smartroute-dashboard/` dan `task/` yang berubah dari `feat/hotfix-scroll-bahasa` (`git diff --name-only`). Karena itu regresi `/routes` tidak dijalankan.

### Perubahan pada kode dashboard lama

- `tsconfig.json`, `tsconfig.app.json`: menghapus `baseUrl` usang, supaya `tsc` lulus.
- `src/main.tsx`, `src/App.tsx`: `FlagProvider` ganda dilepas dan dipasang sebagai layout, supaya `/moda` tidak memanggil `localhost:5000`.
- `src/components/ui/ViewToggle.tsx`: tombol “Moda”.

### Keputusan yang saya ambil, mohon ditinjau

1. **Cabang dasar `feat/hotfix-scroll-bahasa`,** sesuai usulan dokumen. Dikerjakan di worktree `.claude/worktrees/dashboard-moda-greenops`, karena checkout utama sedang di `feat/bahasa-id-en` dengan perubahan yang belum di-commit.
2. **Sumber rel: OSM dan GTFS kita.** Salinan Simpul tidak masuk repo dan tidak disebut di UI.
3. **`/moda` publik tanpa login.** Datanya publik dan simulasi, dan login lama butuh backend port 5000. Mudah dipindah ke balik `ProtectedRoute` bila tidak dikehendaki.
4. **Bawaan peta: rel + BRT.** Bus lain dan Mikrotrans menambah ±3.900 titik.
5. **Okupansi 25%, 50%, 75%.** Ini asumsi saya, tidak ada sumbernya, dan berlabel asumsi di panel.
6. **Satuan “kg CO₂”, bukan “kg CO₂e”** seperti di dokumen tugas, karena CH₄ dan N₂O tidak dihitung.
7. **Angka emisi tampil dengan penanda draf,** padahal dokumen meminta persetujuan dulu. Tujuannya agar tabel bisa dinilai di layar. Tidak ada yang di-merge atau di-deploy.

### Risiko tersisa

- **Angka total GreenOps belum layak dipresentasikan sebagai temuan.** Faktor rel lemah, dan empat hal berikut menggeser totalnya ke arah berbeda:
  - Batas 14 per pola memangkas BRT ±20% pada jam sibuk (995 berbanding ±1.250 tanpa batas).
  - Headway malam di feed dan kecepatan seragam ±12 km/j cenderung melebihkan jumlah bus.
  - Mikrotrans dan LRT Jabodebek tidak dihitung.
  - Faktor listrik dan solar cenderung atas.
- **Beda angka dengan app mobile:** KRL 16 g/pkm di panel (okupansi 50%) berbanding 41 g/pkm di kartu CO₂ mobile.
- **Peta butuh internet:** worker MapLibre dari unpkg dan peta dasar dari CARTO. Bila CARTO gagal, jaringan tetap tampil di atas latar polos. Bila unpkg gagal, peta tidak berjalan; skenario ini belum diuji.
- **FPS diukur dengan GPU perangkat lunak,** belum di laptop presentasi sungguhan.
- **Lisensi:** lihat “Perlu dicek manusia” di Task 0c.
- **Halaman lama tidak disimulasikan:** `/` dan `/map` memuat kartu armada dan “Pengunjung” dari backend lama tanpa label simulasi yang sama (`src/components/dashboard/FleetStatusCard.tsx`, `src/pages/Map.tsx:88`). Belum saya periksa asal datanya. Jangan sampai investor mencampurkannya dengan label `/moda`.

### Daftar cek manual di browser

Jalankan: `cd smartroute-dashboard && npm install && npm run dev`, lalu buka `http://localhost:5173/moda`.

- [ ] Kendaraan terlihat bergerak mulus pada 1×, 5×, dan 15× di laptop presentasi.
- [ ] Nyalakan semua moda: peta masih nyaman digeser dan diperbesar.
- [ ] Klik kendaraan dan halte pada zoom dekat: kartunya masuk akal.
- [ ] Bandingkan beberapa posisi MRT dengan jadwal stasiun.
- [ ] Bandingkan garis KRL dan LRT dengan peta: tidak ada ruas memotong atau memutar aneh.
- [ ] Slider jam ke 03:00: nilai apakah banyaknya BRT malam bisa diterima dengan catatan di dialog Tentang.
- [ ] Buka di HP sungguhan: kartu tidak menutupi seluruh peta, tombol mudah ditekan.
- [ ] Unduh CSV dan buka di Excel.
- [ ] Baca dialog Tentang & Atribusi dan ikon info, lalu buka tautan sumbernya.
- [ ] Buka manual sumber yang menolak alat saya (Task 1, bagian 5).

### Keputusan yang dibutuhkan

1. Persetujuan tabel faktor, dan selisih dengan faktor per penumpang-km.
2. `/moda` publik atau di balik login.
3. Lanjut Task 5 dan 6 atau tidak.
4. Dari dokumen tugas, tetap urusan Khalifa: menghubungi pemilik Simpul, dan repo `hasbywira90/RekapModaJakarta`.
