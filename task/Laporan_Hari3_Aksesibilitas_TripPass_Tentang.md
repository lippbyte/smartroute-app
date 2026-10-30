# Laporan Akhir Hari 3: Aksesibilitas, Trip Pass (Simulasi), "Tentang & Masukan"

**Tanggal:** 31 Okt 2026
**Branch:** `feat/hari3-aksesibilitas-trippass` (dari `feat/hari2-karbon-aqi`; sudah di-push; **belum** di-merge ke `main`)
**Dokumen tugas:** [TASK_ClaudeCode_Hari3_Aksesibilitas_TripPass_Tentang.md](TASK_ClaudeCode_Hari3_Aksesibilitas_TripPass_Tentang.md)

**Ringkasnya:** semua fitur Hari 3 jalan, dan perilaku bawaan tidak berubah:
- Tamu dan akun tanpa profil aksesibilitas mendapat hasil `/routes` dan
  tampilan yang identik dengan Hari 2.
- Info aksesibilitas berbentuk **anotasi** dari data GTFS (opsi C). Tidak
  ada penyaringan atau pengurutan, dan tidak ada janji rute aksesibel.
- Trip Pass adalah **simulasi** dan berlabel di setiap layar.
- Layar "Tentang" bersih dari unsur acara sebelumnya.

Uji layar di HP belum saya lakukan (lihat risiko).

---

## 1. Status per Task

| Task | Status | Commit | Catatan |
|---|---|---|---|
| 0 — Audit | Selesai | — (hanya baca) | Keputusan Khalifa: opsi C, OTP2 tidak diubah |
| 1 — Info aksesibilitas per kandidat (opt-in) | Selesai | `994a15c` | Anotasi saja; parameter OTP2 kursi roda tidak dipakai (membuat hasil kosong) |
| 2 — Profil aksesibilitas yang berfungsi | Selesai | `df53b8d` | 5 bantuan, bawaan mati, diusulkan dari profil |
| 3 — Trip Pass & saldo (SIMULASI) | Selesai | `d564881` | Rincian tarif dari backend (`fare_breakdown`) |
| 4 — "Tentang & Masukan" | Selesai | `a1885ff` | `POST /feedback`; kontak kemitraan `TODO:isi` |
| (opsional) Lapisan data aksesibilitas resmi MRT/LRT | **Ditunda** | — | Task 1–4 tidak selesai lebih awal; tidak ditambah tanpa sumber yang diperiksa |
| 5 — Regresi & laporan | Selesai | commit laporan ini | Lihat bagian 3 |

---

## 2. Temuan data aksesibilitas (Task 0a)

Nilai GTFS: 1 = bisa, 2 = tidak bisa, kosong/0 = tidak ada info.

| Feed | Halte/stasiun (`wheelchair_boarding`) | Perjalanan (`wheelchair_accessible`) | `pathways`/`levels` |
|---|---|---|---|
| TransJakarta | 7.819 titik naik · terisi **96,9%** · **0,8% bisa** (61 halte) · **96,1% tidak bisa** · 3,1% kosong | 700 trip · **0%** | tidak ada |
| KRL | 83 stasiun · **kolom tidak ada** | kolom tidak ada | tidak ada |
| MRT | 13 stasiun · **kolom tidak ada** | kolom tidak ada | tidak ada |
| LRT | 18 stasiun · **kolom tidak ada** | kolom tidak ada | tidak ada |

**Catatan per sumber:**
- **TransJakarta:** halte BRT (awalan `G`) tercatat 60 bisa dan 457 tidak
  bisa. Halte bus jalanan (`B`) hampir semuanya tidak bisa.
- **OTP2 2.10:** meneruskan data ini ke GraphQL. Tetapi preferensi routing
  kursi roda bawaannya membuat S1, S3, dan S2 **kosong**
  (`NO_TRANSIT_CONNECTION`, hanya tersisa "jalan kaki 159–221 menit"),
  karena data perjalanan 0%.
- **OSM:** tag `wheelchair` muncul di 15% blok, `elevator` di 35 blok, dan
  `tactile_paving` di 59 blok, jadi datanya tipis.

**Bagaimana data ini muncul di app** (dengan "Tampilkan info aksesibilitas"
aktif):
- Pada skenario demo, tingkat yang muncul hanya **rendah** dan
  **tidak_diketahui**.
- "Tinggi" tidak pernah tercapai, dan memang tidak ditampilkan selama data
  armada 0%.
- Bahasanya selalu "tercatat … (menurut data GTFS)".

---

## 3. Hasil regresi (sebelum vs sesudah Hari 3)

**Ketepatan hasil:** identik dengan baseline Hari 2 (yang sama dengan Hari 1;
jam terkunci `2026-09-21T07:30+07:00`). Yang dibandingkan: urutan, skor,
tarif, menit, transfer, risiko, kepadatan, dan jumlah kandidat.

| Skenario | Kandidat | #1 | Hasil | Latensi Hari 2 akhir → Hari 3 akhir |
|---|---|---|---|---|
| S1 Blok M → Kota | 4 | `1` Rp3.500 | **Identik** | 345 → 350 ms |
| S3 Grogol → Kp. Melayu | 4 | `3+8+5C` | **Identik** | 2.604 → 2.741 ms |
| S2 Pasar Baru → Lebak Bulus | 4 | `2+1+M` | **Identik** | 1.495 → 1.416 ms |
| S2 setelah lapor Monas | 4 | `Bogor+Cikarang+M` | **Identik, tetap berbalik** | 1.340 → 1.257 ms |
| L1 / L2 (LRT) | 3 / 3 | sama | **Identik** | 290 → 344 / 1.204 → 1.145 ms |

**Catatan pengukuran:**
- **Status OTP2:** image 2.10.0, container mulai 30 Okt 22:48 UTC, tanpa
  restart, dan menjawab dalam 275 ms. Server dipanaskan 3 putaran sebelum
  diukur.
- **Latensi:** setara dengan Hari 2. Kenaikan terhadap baseline Hari 1 berasal
  dari lingkungan, seperti sudah dibuktikan lewat A/B di Hari 2.
- **Toggle aksesibilitas:** latensi mati vs nyala setara (S3 2.520 vs
  2.578 ms). Tanpa toggle, query ke OTP2 identik dengan sebelumnya.
- **Tarif:** setelah tarif dipecah menjadi `fare_breakdown`, tarif tidak
  bergeser sama sekali.

**Chip moda:** 4/4. **`npx tsc`:** backend 0, frontend 0.

**Semua uji Hari 1–3 dijalankan ulang di akhir:**

| Skrip | Hasil |
|---|---|
| `test-akun-riwayat.mjs` ratelimit (+tunnel) / main / persist (setelah restart) | 10/10 · 48/48 · 3/3 |
| `test-toto-privacy.mjs` | 16/16 |
| `test-air-quality.mjs` | 11/11 |
| `test-feedback.mjs` (+tunnel) — **baru** | 11/11 |
| `smartroute/scripts/test-co2-pipeline.mts` | 10/10 |
| `smartroute/scripts/test-route-badges.mts` | 19/19 |
| `smartroute/scripts/test-accessibility-pipeline.mts` — **baru** (65 titik dicocokkan ke OTP2 langsung) | 54/54 |
| `smartroute/scripts/test-assistive-settings.mts` — **baru** (termasuk body request asli saat bantuan mati = Hari 2) | 26/26 |
| `smartroute/scripts/test-trip-pass.mts` — **baru** (main + proses baru) | 23/23 · 1/1 |
| `smartroute/scripts/test-feedback-draft.mts` — **baru** (backend mati → proses baru) | 2/2 · 5/5 |
| Chip moda | 4/4 |

Backend di-restart di akhir, dan `/crowd-reports` kosong.

---

## 4. `TODO:verifikasi` dan keputusan yang butuh Khalifa

**Keputusan:**
1. **Kontak kemitraan** (`DEVELOPER_INFO.partnershipContact`, saat ini
   "segera tersedia") dan **tagline final** (saat ini "Navigate Smarter.
   Travel Better.") di `smartroute/src/constants/developerInfo.ts`.
2. **Kebenaran data TransJakarta.** 96% halte tercatat "tidak bisa" untuk
   kursi roda, termasuk Blok M. Sebelum ditunjukkan ke investor, sebaiknya
   dicek ke TransJakarta atau ke lapangan, karena app menampilkannya apa
   adanya (berlabel "menurut data GTFS").
3. **Rebuild Dev Client** (dari Hari 1–2): `expo-secure-store`, splash
   berlogo. Hari 3 tidak menambah paket native.
4. **Kunci OpenRouter dan IQAir** (dari Hari 1–2) masih menunggu.

**`TODO:verifikasi` baru:**

| Lokasi | Isi |
|---|---|
| `smartroute/src/app/trip-pass.tsx` | Teks cara bayar per moda (umum, tanpa merek); cocokkan dengan ketentuan resmi operator |
| `smartroute/src/constants/developerInfo.ts` | Kontak kemitraan (`TODO:isi`), tagline final |
| Getar peringatan (`navigate.tsx`) | Izin `VIBRATE` ada di konfigurasi saat ini; pastikan sekali di HP bahwa binary terpasang memuatnya |
| `backend/.../src/services/accessibility.ts` | "Tinggi" baru bisa tampil bila ada data aksesibilitas armada |
| (dari hari sebelumnya) | Faktor emisi, lokasi & atribusi IQAir, tarif MRT (sumber sekunder), libur nasional LRT, token tidak terenkripsi, localtunnel XFF |

---

## 5. File di luar rencana dokumen

| File | Alasan |
|---|---|
| `backend/.../src/services/routing.ts` (`computeFareBreakdown`, `gatedJourneys`) | Trip Pass butuh tarif per segmen "dari backend, tanpa dihitung ulang". Rincian dibangun di fungsi yang sama dengan `cost_idr` (regresi tarif identik) |
| `smartroute/src/components/Text.tsx` (`cssInterop`) | Satu-satunya cara "Tampilan mudah dibaca" berlaku di semua layar inti tanpa mengubah tiap layar. Saat bantuan mati, gayanya sama persis |
| `smartroute/src/components/account/DeveloperInfoSheet.tsx` | **Dihapus**, diganti layar `/about` |
| `smartroute/src/components/CustomTabBar.tsx`, `QuickLocationCard.tsx` | Label pembaca layar (Task 2) |
| `smartroute/scripts/test-support/asyncstorage-stub.mjs` | Uji "bertahan setelah app dibuka ulang" tanpa HP |

Tidak ada perubahan OTP2/`router-config`, GTFS, tarif, crowd report, auth, atau
paket native. `package.json` tidak berubah.

---

## 6. Status git

- **Ter-commit & ter-push di `feat/hari3-aksesibilitas-trippass`:** `994a15c`,
  `df53b8d`, `d564881`, `a1885ff`, dan commit laporan ini. `main` tidak disentuh.
- **Tertinggal di working tree, sengaja tidak di-commit:**
  `smartroute-dashboard/package-lock.json` (sudah berubah sebelum Hari 1) dan
  tiga dokumen tugas `task/TASK_ClaudeCode_Hari{1,2,3}_*.md`.

---

## 7. Risiko untuk Hari 4

1. **Uji di HP sangat dibutuhkan untuk Hari 3.** Belum saya lakukan:
   - `Text` kini lewat `cssInterop`, jadi perlu dicek bahwa semua layar tampil
     sama di native saat bantuan mati, dan teks tidak terpotong di layar
     sempit saat "mudah dibaca" aktif;
   - getar dan teks besar saat GPS memindah langkah dan saat tiba;
   - mode sederhana selama perjalanan sungguhan;
   - sakelar di Profil;
   - Trip Pass dan modal top-up;
   - form masukan dengan keyboard native.

   Yang sudah terverifikasi: `tsc`, render SSR web, semua logika lewat kode
   asli app, dan semua kontrak backend.
2. **Klaim aksesibilitas ke investor.** Data KRL/MRT/LRT 0% dan data armada
   0%. Narasi yang jujur: "kami menampilkan apa yang tercatat, dan
   membangun audit berbasis komunitas" (sudah di roadmap layar Tentang).
3. **Kontras bawaan.** Beberapa teks abu-abu (`#A3A3A3`, `#94A3B8`) hanya
   sekitar 2,5:1 di latar putih pada tampilan normal. Mode "mudah dibaca"
   menaikkannya ke sekitar 7,7:1. Memperbaikinya untuk semua pengguna di luar
   cakupan Hari 3.
4. **Masukan belum punya layar baca.** Data ada di SQLite (tabel `feedback`),
   dan perlu cara bagi tim untuk membacanya, misalnya skrip ekspor.
5. **Latensi lingkungan** (OTP2/laptop), **kunci OpenRouter/IQAir**, dan
   **Q5 TOTO** masih terbawa dari Hari 1–2.
6. **Generator tipe rute Expo** dengan dua Metro sekaligus: kalau `tsc`
   mengeluh soal rute baru, restart Metro.
