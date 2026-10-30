# Laporan Akhir Hari 2: Jejak Karbon, Rute "Sehat", Kualitas Udara, Logo

**Tanggal:** 30 Okt 2026
**Branch:** `feat/hari2-karbon-aqi` (dari `feat/hari1-akun-riwayat`; sudah di-push; **belum** di-merge ke `main`)
**Dokumen tugas:** [TASK_ClaudeCode_Hari2_Karbon_Sehat_AQI_Logo.md](TASK_ClaudeCode_Hari2_Karbon_Sehat_AQI_Logo.md)

**Ringkasnya:** estimasi CO₂, lencana, info udara, prioritas "Sehat", dan logo
sudah jalan. Hasil rute tidak berubah sedikit pun: urutan, tarif, menit,
kandidat, dan skor identik dengan baseline Hari 1. Kualitas udara masih
memakai provider tiruan karena kunci IQAir belum dipasang. Splash native
tidak diubah, karena itu butuh rebuild.

---

## 1. Status per Task

| Task | Status | Commit | Catatan |
|---|---|---|---|
| 0 — Audit + tabel faktor | Selesai | — (hanya baca) | Tabel faktor disetujui Khalifa (LRT = proksi MRT 19, motor = 100) |
| 1 — CO₂ per kandidat `/routes` | Selesai | `a937f33` | Field tambahan saja; juga `GET /emission-factors` |
| 2 — `GET /air-quality` (IQAir) | Selesai, dengan provider tiruan | `947fd4f` | Kunci `IQAIR_API_KEY` belum dipasang → `available:false` |
| 3 — CO₂, lencana, info udara di app | Selesai | `ed6a0a3` | + layar "Tentang angka ini" |
| 4 — Prioritas "Sehat" | Selesai | `331e88b` | Disimpan + konteks TOTO, belum mengubah urutan |
| 5 — Logo di splash JS | Selesai (lapisan JS) | `48fc09d` | Splash native tidak diubah (lihat bagian 7) |
| 6 — Regresi & laporan | Selesai | commit laporan ini | Lihat bagian 4 |

---

## 2. Tabel faktor emisi (disetujui)

Satuan: gram CO₂e per penumpang-km. Semua hasil ditampilkan sebagai
**estimasi**. Sumber tunggal di kode: `backend/backend-skeleton/src/services/emissionFactors.ts`
(versi `2026-10-30.1`), ditampilkan di app pada layar "Tentang angka ini".

| Moda | Nilai | Sumber | Tahun / data | Okupansi | Status |
|---|---|---|---|---|---|
| Jalan kaki | 0 | — | — | — | Ditetapkan dokumen |
| MRT Jakarta | 19 | Studi LCA tim Universitas Pertamina, jurnal ARASET (0,019 kg/pkm) | Masa COVID-19 | Kapasitas ±50% | `TODO:verifikasi` (teks lengkap belum diperiksa) |
| LRT Jabodebek | 19 | Proksi MRT (keputusan Khalifa) | — | — | `TODO:verifikasi` |
| KRL | 41 | Klaim KAI Commuter 19–41 g (via IDXChannel), dipakai batas atas | Tidak disebut | Tidak disebut | `TODO:verifikasi` |
| Bus TransJakarta (semua leg BUS) | 36 | Studi ARASET yang sama (BRT 0,036 kg/pkm) | Masa COVID-19 | Kapasitas ±50% | `TODO:verifikasi` (JakLingko/Mikrotrans memakai angka yang sama) |
| Pembanding: mobil sendirian | 170 | UK DESNZ 2022 via Our World in Data (petrol car 170,48) | 2022 | 1 orang | `TODO:verifikasi` (okupansi tidak ditulis eksplisit OWID) |
| Pembanding: motor | 100 | Nilai konservatif tim (DESNZ 113,55; KAI mengutip 90–110) | 2022 | 1 pengendara | `TODO:verifikasi` |

Jarak pembanding mobil/motor = **jumlah jarak semua leg** (termasuk jalan
kaki), dilabeli "jarak proksi" di app.

---

## 3. `TODO:verifikasi` dan keputusan yang butuh Khalifa

**Keputusan:**
1. **Kunci IQAir.** Isi `IQAIR_API_KEY` langsung di `backend/backend-skeleton/.env`,
   restart backend, lalu buka `/air-quality`. Sebelum demo, cek dua hal yang
   ditandai `TODO:verifikasi`: penulisan kota/provinsi/negara (`Jakarta` /
   `Jakarta` / `Indonesia`) dan **syarat atribusi IQAir** untuk ditampilkan di app.
2. **Satu rebuild Dev Client di akhir** (lihat bagian 7). Saat ini tidak ada
   paket native baru, sesuai aturan.
3. **Kunci OpenRouter** (tertunda sejak Hari 1). TOTO masih mati sampai kunci
   baru dipasang.

**`TODO:verifikasi` di kode:**

| Lokasi | Isi |
|---|---|
| `services/emissionFactors.ts` | Semua faktor kecuali jalan kaki (lihat tabel di bagian 2) |
| `services/airQuality.ts` | Penulisan lokasi yang dikenali IQAir; syarat atribusi |
| `smartroute/src/utils/routeBadges.ts` | Rentang jalan kaki "sedang" 800–1.600 m untuk lencana "Aktif sehat" |
| (dari Hari 1) | Token di AsyncStorage tidak terenkripsi; 409 saat daftar; batas login IP+email; localtunnel XFF; teks persetujuan aksesibilitas |

---

## 4. Hasil regresi (sebelum vs sesudah Hari 2)

**Ketepatan hasil:** identik dengan baseline Hari 1 (jam terkunci
`2026-09-21T07:30+07:00`, `scripts/regression-routes.mjs`). Yang dibandingkan
per kandidat: urutan, tarif, menit, jumlah transfer, risiko, kepadatan, dan
**skor**.

| Skenario | Kandidat | #1 | Hasil |
|---|---|---|---|
| S1 Blok M → Kota | 4 → 4 | `1` Rp3.500, 92–106 mnt | **Identik** |
| S3 Grogol → Kp. Melayu | 4 → 4 | `3+8+5C` Rp3.500 | **Identik** |
| S2 Pasar Baru → Lebak Bulus | 4 → 4 | `2+1+M` Rp17.500 | **Identik** |
| S2 setelah lapor Monas | 4 → 4 | `Bogor+Cikarang+M` Rp17.000 | **Identik, tetap berbalik** |
| L1, L2 (LRT) | 3 → 3 | sama | **Identik** |

**Latensi: perlu dibaca hati-hati.**
- Tepat setelah Task 1, latensi **setara atau lebih cepat** dari baseline
  (S1 315 → 251 ms, S3 1.840 → 1.706 ms, PB 989 → 995 ms).
- Pada regresi akhir, latensi **naik** (S3 ±2,6 detik, PB ±1,5 detik). Saya
  berhenti dan mengecek penyebabnya:
  - Biaya perhitungan CO₂ diukur langsung: **0,7 µs per kandidat**, sekitar
    0,003 ms per pencarian.
  - **Uji A/B saat itu juga**, dengan kode Hari 1 (port 3103) vs kode Hari 2
    (port 3000), OTP2 yang sama, 4 putaran bergantian:

| Skenario | Kode Hari 1 sekarang (median) | Kode Hari 2 sekarang (median) | Baseline Hari 1 |
|---|---|---|---|
| S1 | 460 ms | 486 ms | 315 ms |
| S3 | 2.519 ms | 2.576 ms | 1.840 ms |
| PB | 1.500 ms | 1.563 ms | 989 ms |

**Kesimpulan:** kode Hari 1 sama lambatnya bila diukur sekarang, jadi
kenaikan berasal dari **lingkungan** (OTP2 dan/atau beban laptop), bukan
dari perubahan Hari 2. Selisih median Hari 2 vs Hari 1 hanya +2–5%, dan
rentang tiap putaran saling tumpang tindih. Lihat risiko no. 1.

**Chip & filter:**
- Chip moda Bus/KRL/MRT/LRT: 4/4, masing-masing hanya memakai moda yang diminta.
- Logika chip kriteria/filter/urutan di layar hasil tidak berubah
  (dicek dengan `git diff main`). Chip default tetap "Semua", dan tidak ada
  chip "Sehat".

**`npx tsc`:** backend 0 galat, frontend 0 galat.

**Semua uji dijalankan ulang di akhir:**

| Skrip | Hasil |
|---|---|
| `test-akun-riwayat.mjs ratelimit` (+ tunnel ngrok) | 10/10 |
| `test-akun-riwayat.mjs main` (Hari 1 + "sehat") | 48/48 |
| `test-akun-riwayat.mjs persist` (setelah restart sungguhan) | 3/3 |
| `test-toto-privacy.mjs` | 16/16 |
| `test-air-quality.mjs` (provider IQAir tiruan) | 11/11 |
| `smartroute/scripts/test-co2-pipeline.mts` (kode asli app: HTTP → adapter → `POST /trips`) | 10/10 |
| `smartroute/scripts/test-route-badges.mts` (AQI tiruan Baik/Tidak sehat/tanpa data/stale) | 19/19 |
| Chip moda | 4/4 |

Contoh angka asli (S1):

| Rute | CO₂ | Dibanding mobil sendirian |
|---|---|---|
| `1` | 480 g | −81% |
| `M+1` | 380 g | −85% |
| `M+Cikarang+Bogor` | 630 g | −81% |
| `M+Bogor` | 380 g | −86% |

- **Paling hijau:** M+1 dan M+Bogor seri di 380 g, jadi tie-break memakai
  urutan backend dan lencananya jatuh ke **M+1**.
- **Dengan AQI Baik:** rute `1` mendapat "Aktif sehat" (jalan kaki 1.593 m).
- **S3 tidak mendapat "Aktif sehat"**, karena tidak ada rute yang jalan
  kakinya 800–1.600 m. Lencananya tidak dipaksakan.

Backend di-restart di akhir, dan `/crowd-reports` kosong.

---

## 5. File di luar rencana dokumen

| File | Alasan |
|---|---|
| `backend/.../routes/emissionFactors.ts` (`GET /emission-factors`, publik) | Sumber layar "Tentang angka ini" (keputusan 1), supaya penjelasan dan perhitungan memakai berkas faktor yang sama |
| `smartroute/src/app/co2-info.tsx` | Layar "Tentang angka ini" (keputusan 1) |
| `smartroute/scripts/test-support/*` | Stub `react-native` agar kode asli app bisa diuji di Node (bukan bagian app) |
| `backend/.../lib/db.ts` | Tabel `iqair_calls` dan `air_quality_last` (pagar & cadangan tahan restart) |

Tidak ada yang menyentuh OTP2, GTFS, tarif, crowd report, atau auth/riwayat
di luar yang disebut dokumen. Tidak ada paket baru (`package.json` tidak berubah).

---

## 6. Status git

- **Ter-commit & ter-push di `feat/hari2-karbon-aqi`:** `a937f33`, `947fd4f`,
  `ed6a0a3`, `331e88b`, `48fc09d`, dan commit laporan ini. `main` tidak disentuh.
- **Tertinggal di working tree, sengaja tidak di-commit:**
  `smartroute-dashboard/package-lock.json` (sudah berubah sebelum Hari 1) dan
  dua dokumen tugas (`TASK_ClaudeCode_Hari1_...md`, `TASK_ClaudeCode_Hari2_...md`).

---

## 7. Status splash native dan opsi rebuild

- **Splash native** (`app.json` → `expo-splash-screen`, gambar
  `splash-background.png`) **tidak memuat logo apa pun**. Isinya hanya siluet
  Monas dan patung Selamat Datang di atas `#001C43`. Jadi tidak ada "logo lama"
  yang tampil. Tidak diubah, karena itu butuh rebuild.
- **Lapisan JS** (`SplashIntro`) kini menampilkan logo resmi. Lingkarannya ikut
  memudar masuk bersama logo, jadi tidak ada kedip, dan durasinya tidak berubah.
- **Usulan:** kumpulkan dalam **satu rebuild Dev Client** di akhir:
  1. Splash native dengan logo: `splash-background.png` versi berlogo, atau
     `image` logo di atas `backgroundColor`.
  2. `expo-secure-store` untuk token (`TODO` dari Hari 1).
  3. Opsional: memastikan `react-native-svg` ikut ter-build, kalau logo mau
     dipakai sebagai SVG.

---

## 8. Risiko untuk Hari 3

1. **Latensi rute naik dibanding baseline**, karena faktor lingkungan (lihat
   bagian 4). Sebelum demo: restart container OTP2 dan tutup proses berat,
   lalu panaskan dengan beberapa pencarian. Kalau masih lambat, ukur OTP2
   langsung sebelum mencurigai kode.
2. **Kunci IQAir dan OpenRouter** belum dipasang. Kartu udara dan lencana udara
   tidak tampil, dan TOTO mati.
3. **Faktor emisi lemah sumbernya** (semua `TODO:verifikasi` kecuali jalan
   kaki). Untuk investor, sebut "estimasi" dan tunjukkan layar "Tentang angka ini".
4. **TOTO Q5** (10–15 detik sebelum LLM, dari Hari 1). Ukur ulang setelah kunci
   baru.
5. **Generator tipe rute Expo** menulis entri aneh `/../…` saat dua Metro
   (8081 + 8097) jalan bersamaan dan ada file baru. `tsc` tetap lulus selama
   rute aslinya terdaftar. Kalau `tsc` mengeluh soal rute baru, restart Metro.
6. **Hari 3 (aksesibilitas pada routing):** jangan mengubah urutan atau skor
   tanpa regresi S1/S2/S3. Pola "field tambahan + regresi + uji A/B" dari
   Hari 2 bisa dipakai ulang.
7. **Uji layar di HP** (kartu sempit, lencana, logo splash) belum saya lakukan.
   Yang sudah terverifikasi: `tsc`, SSR web, pratinjau gambar logo, dan semua
   kontrak backend.
