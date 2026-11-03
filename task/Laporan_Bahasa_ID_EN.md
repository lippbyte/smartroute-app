# Laporan Task A & B — Gulir Pemilih Lokasi dan Bahasa ID/EN

**Cabang:** `feat/bahasa-id-en`, dari `1549e0a` (`feat/hotfix-scroll-bahasa`). **Tidak di-merge ke `main`, tidak ada tag.** Khalifa yang memutuskan tag setelah uji HP.
**Tanggal:** 3 Nov 2026. Tanpa rebuild Dev Client, tanpa paket baru, `Text.tsx` tidak diubah, prompt TOTO tidak diubah, tanpa panggilan LLM berbayar.
**Bahasa Inggris belum diuji di HP.** Pengujiannya di browser (CDP) dan Node. Daftar cek HP ada di bagian 6.

## 1. Ringkasan

| Pekerjaan | Status | Commit |
|---|---|---|
| Task A: gulir pemilih titik | Selesai; **gulir terkonfirmasi di HP oleh Khalifa** | `445d509`, `3cd0b74` |
| Ikon APK dari logo baru | Berkas & konfigurasi selesai; baru terlihat setelah build APK | `e4d4031` |
| Versi app 1.1.1 | Selesai; versi di info APK berubah pada build berikutnya | `5e7634a` |
| Kartu udara bisa diketuk, layar detail IQAir | Selesai (backend & app) | `1549e0a` |
| Task B: modul bahasa, pilihan bahasa, Profil, Masuk/Daftar, Onboarding | Selesai (web) | `39abe4d` |
| Task B: Beranda, pemilih lokasi, Hasil Rute, Detail, udara | Selesai (web) | `2c0575b` |
| Task B: Navigasi, Ringkasan, Riwayat, Penilaian, Trip Pass, Tentang, TOTO | Selesai (web) | `e117550` |
| Task B: Peta Kepadatan & Lapor Kepadatan | Selesai (web); kartu info native belum teruji | `c73ba0b` |
| Kategori udara dari kode ke label bahasa aktif | Selesai (web) | `10ac12a` |
| Nama polutan utama mengikuti bahasa aktif | Selesai (web) | commit laporan ini |
| 10 kali cold start di HP | **Belum dilakukan**, butuh HP (bagian 7) | — |
| Bagian Kemitraan | **Tetap tersembunyi**, menunggu konfirmasi Khalifa; hanya teksnya masuk kamus | — |

Commit terakhir yang gulirnya sudah dicoba Khalifa di HP adalah `e4d4031`. Commit sesudahnya belum diuji di perangkat.

## 2. Task A: yang terjadi di HP

- **Akar masalah gulir** tetap seperti di `Laporan_Hotfix_Scroll_TOTO.md`: memilih saat jari menyentuh (`onPressIn`), dan dua dialog tanpa `ScrollView`.
- **Laporan "gulir masih bermasalah" kemungkinan berasal dari bundle lama.** Metro mencatat HP hanya memuat 2004 modul sejak menyala, sedangkan kode terbaru 2007 modul pada URL yang sama, dan tunnel sempat putus dua kali. Setelah reload, gulir beres tanpa perubahan kode.
- **Dugaan saya soal batas induk di Android tidak terbukti.** Daftar saran memang meluber ke luar batas induknya, tetapi di HP yang diuji gulir berjalan. Tidak ada kode yang diubah karena dugaan itu.
- **Layar merah saat reload (`globalThis.expo` belum ada)** hilang, dan app bisa dibuka lagi. Penyebabnya **belum terbukti**. Bundle sebelum dan sesudah restart Metro identik sampai byte terakhir, dan tidak ada kode `smartroute/src` di stack. Bila muncul lagi saat demo: tutup paksa app, lalu buka lagi.

## 3. Task B: desain

- Modul sendiri di `src/i18n`: kamus `id` dan `en` (590 kunci), `t(key, params)`, tersimpan di AsyncStorage, bawaan Indonesia, tanpa deteksi perangkat.
- Pilihan bahasa ada di Profil (dengan catatan "Sebagian teks dari server masih berbahasa Indonesia.") dan di layar Masuk.
- Format mengikuti bahasa tanpa mengubah angka: `Rp 3.500` / `Rp 3,500`, `1,2 km` / `1.2 km`, `30 Okt` / `30 Oct`.
- Label dan kriteria rute (`Cepat`, `Murah`, `Tenang`) tetap nilai logika untuk filter dan urutan; hanya tampilannya yang diterjemahkan.
- **Berganti bahasa memasang ulang navigator** (`key` di `app/_layout.tsx`), karena React Compiler menyimpan hasil pemanggilan fungsi per komponen dan teks lama bisa tetap tampil. Dampaknya: isian yang sedang diketik di layar itu hilang saat berganti bahasa. Layar yang terbuka tetap sama (uji G3, G15).

## 4. Daftar layar

| Status | Layar |
|---|---|
| **Sudah (dokumen Task B)** | Profil, Masuk, Daftar, Onboarding, Beranda, pemilih lokasi, Tujuan Cepat, Hasil Rute (kartu, chip, lencana, filter), Detail, Navigasi, Mode sederhana, Ringkasan, Riwayat, Detail perjalanan, Penilaian, Trip Pass, Tentang, TOTO (teks antarmuka), menu samping, tab |
| **Sudah (tambahan)** | Detail kualitas udara, Peta Kepadatan, Lapor Kepadatan |
| **Belum (di luar daftar dokumen)** | Halte Terdekat, Semua Halte, Tentang angka ini |

**Tetap Indonesia sesuai dokumen, karena dari server:** ringkasan aksesibilitas rute, label dan catatan rincian tarif, pesan galat server, jawaban TOTO, nama tempat dan rute.

**Kategori udara kini mengikuti bahasa aktif**, dipetakan dari `category_key`; teks server hanya cadangan untuk kode yang tidak dikenal.

**Polutan utama juga mengikuti bahasa aktif.** Backend mengirim nama, bukan kode IQAir, jadi pemetaan memakai nama itu: "Ozon (O₃)" menjadi "Ozone (O₃)", sedangkan PM2.5, PM10, NO₂, SO₂, dan CO adalah simbol yang sama. Nama yang tidak dikenal ditampilkan apa adanya.

## 5. Hasil uji

| Uji | Hasil |
|---|---|
| Kamus & modul (`test-i18n`) | 40/40: kunci `id` = `en`, placeholder sama, fallback ke ID, tanpa kunci mentah, pilihan bertahan setelah dibuka ulang, `t()` tidak di tingkat modul, setiap kunci dipakai, kategori dan polutan ID sama persis dengan backend, 58 berkas cakupan tanpa teks Indonesia tersisa |
| **Polutan utama** (`pollutant`) | 56/56: keenam nama di kartu Beranda dan layar detail, ID dan EN pada 320 px, plus ozon dengan kategori terpanjang di Beranda dan Hasil Rute; tidak keluar tepi, tidak terpotong |
| **Kesetaraan ID** (`test-i18n-screens parity`) | 63/63: 61 layar & keadaan **identik** dengan baseline. 51 direkam dari `1549e0a`, 10 layar kepadatan dari `16b29b9` sebelum diterjemahkan. Tambahan hanya pilihan bahasa dan catatannya |
| **Kesetaraan SSR web** | 25 halaman identik, 194 string di 23 halaman. Tambahan hanya pilihan bahasa di Masuk |
| **Bahasa Inggris, 320 px** (`english`) | 369/369 di 61 layar: tanpa teks Indonesia buatan app, tanpa kategori udara Indonesia, tanpa kunci mentah, tidak lebih buruk dari ID |
| **Berganti bahasa** (`switch`) | 16/16: tetap di layar yang sama, hasil rute ikut berganti termasuk tarif, kembali ke ID identik, bertahan setelah dimuat ulang |
| Regresi `/routes` | S1, S2 sebelum/sesudah Monas, S3, L1, L2 **identik** baseline; chip moda 4/4 |
| `tsc` | 0 galat |
| Uji app | assistive 34, gps 17, lencana 19, CO₂ 11, kemitraan 7, aksesibilitas 54, Trip Pass 27+1, draf masukan offline 2, pemetaan galat 69 & 17, pindai teks lulus |
| Uji browser | detail udara 22, kartu rute 34, gulir 33, layar TOTO 22 |

**Tiga uji lama diubah** karena membaca teks dari sumber, yang kini ada di kamus; perilaku yang diuji tetap sama: `test-trip-pass` T10e, `test-route-card-layout` S, `test-about-partnership` K4. `test-error-mapping` kini memanggil fungsi pesan, bukan konstanta.

**Tidak diulang:** preflight, karena memakai satu panggilan TOTO berbayar; kode backend tidak berubah di Task B. Fase `online` `test-feedback-draft` juga tidak dijalankan, karena menulis ke backend.

**Yang sudah ada sebelum Task B, sama di ID dan EN pada 320 px, tidak diubah:**
- Modal top-up dan penilaian keluar tepi di web. Kemungkinan karena gambar latar melebarkan viewport web; belum diperiksa di HP.
- "Tap untuk atur" dan nama slot Tujuan Cepat terpotong.
- Tarif di Ringkasan terpotong di web; native memakai `adjustsFontSizeToFit`.

**Keputusan untuk Khalifa:**
1. **TOTO dalam bahasa Inggris** `TODO:verifikasi`: tombol saran mengirim pertanyaan Inggris, prompt tidak diubah, dan jawabannya belum diuji karena tanpa panggilan berbayar. Saran: jangan dipakai di demo sebelum diuji.
2. **Tautan "Buka di situs IQAir"** `TODO:verifikasi`: `https://www.iqair.com/indonesia/jakarta` menjawab 429 dari laptop ini, jadi halamannya belum terkonfirmasi.
3. **Build APK untuk ikon dan versi:** kapan, dan profil apa. Tidak dikerjakan sebelum diminta.
4. **Tag `demo-candidate-1`:** tidak dibuat sebelum diminta. `e4d4031` adalah commit terakhir yang gulirnya sudah dicoba di HP.

## 6. Daftar cek HP (Android dan iOS bila ada)

Tutup app sepenuhnya lalu buka lagi supaya memuat bundle terbaru. Yang paling penting ditandai ★.

**Bahasa**
- [ ] ★ Akun > Language/Bahasa > English: layar langsung Inggris, tetap di Akun, tanpa layar merah.
- [ ] ★ Tutup app lalu buka lagi: tetap Inggris.
- [ ] ★ Pilih Bahasa Indonesia: tampilan kembali seperti semula, dan bertahan setelah dibuka ulang.
- [ ] Keluar dari akun, di layar Masuk pilih English: teks berganti, tetap di layar Masuk.
- [ ] ★ Buka hasil rute, pindah ke tab Akun, ganti bahasa, kembali ke tab Rute: kartu mengikuti bahasa, tarif `Rp 3,500`, rute tetap ada.
- [ ] Dalam Inggris: Detail, Trip Pass (cek saldo, top-up), Navigasi sampai Ringkasan, Riwayat, Penilaian.
- [ ] Dalam Inggris di HP layar kecil: teks tidak terpotong, tarif dan tombol tidak bergeser.
- [ ] Dalam Inggris: peringatan teks besar dan mode sederhana navigasi terbaca benar.
- [ ] Modal top-up dan penilaian di HP layar kecil: tidak keluar tepi (di web keluar tepi, ID maupun EN).

**Peta Kepadatan & Lapor Kepadatan, dalam Inggris**
- [ ] ★ Peta, legenda, dan tombol Report berbahasa Inggris.
- [ ] ★ Ketuk penanda di peta: kartu info berbahasa Inggris (tidak teruji di web, karena web memakai popup).
- [ ] Report > cari halte > pilih tingkat: laporan terkirim dan penanda muncul. Kirim hanya saat tidak mengganggu skenario S1 (laporan berlaku 15 menit).

**Kartu udara**
- [ ] ★ Dalam Inggris, kartu menulis "Air in Jakarta: Unhealthy" atau kategori aktif lain, dan "Main pollutant ...", tanpa teks Indonesia.
- [ ] Bila polutan utama hari itu ozon: Inggris "Ozone (O₃)", Indonesia "Ozon (O₃)". Polutan mengikuti data hari itu; PM2.5 tampil sama di kedua bahasa, jadi ozon sudah teruji di web bila tidak muncul.
- [ ] Di HP layar kecil, kartu udara tidak terpotong di Beranda dan Hasil Rute.
- [ ] ★ Beranda > kartu udara: layar detail terbuka, dengan AQI, polutan, cuaca, dan skala.
- [ ] Hasil Rute > kartu udara ringkas: layar yang sama.
- [ ] "Buka di situs IQAir" membuka halaman Jakarta yang benar.

**Versi & ikon**
- [ ] Tentang menulis "Versi 1.1.1".
- [ ] Setelah build APK: ikon launcher memakai logo baru, dalam bentuk lingkaran maupun kotak membulat.

**Tetap dari daftar sebelumnya**
- [ ] Sisa butir di `Laporan_Hotfix_Scroll_TOTO.md` bagian 5, selain gulir yang sudah dikonfirmasi.

## 7. Cold start di HP: 10 kali

**Belum dilakukan, dan tabel di bawah masih kosong.** HP tidak tersambung ke laptop (`adb devices` kosong), jadi hasilnya harus datang dari perangkat. Tujuannya menjawab apakah layar merah `Cannot read property 'EventEmitter'` muncul lagi.

**Cara A, HP disambung USB dengan USB debugging menyala:** Claude Code atau tim menjalankan `powershell -File smartroute/scripts/cold-start-check.ps1 -Runs 10` dari root repo. Skrip mencatat status dan waktu tiap putaran ke CSV. Skrip ini belum pernah dijalankan pada perangkat.

**Cara B, manual, tiap putaran:**
1. Pengaturan Android > Aplikasi > smartroute > Paksa berhenti.
2. Buka app, masuk ke `https://a3c0lx4-lippbyte-8081.exp.direct` bila diminta.
3. Hitung sampai Beranda tampil. Bila layar merah muncul, foto dan catat; jangan tekan RELOAD sebelum dicatat.

| # | Jam | Beranda tampil? | Layar merah? | Detik | Catatan |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |

**Catat juga:** model HP dan versi Android, jaringan yang dipakai (Wi-Fi atau data seluler), dan commit `10ac12a` atau sesudahnya. Metro mencatat satu baris `Android Bundled` untuk tiap muatan, jadi jumlah muatannya bisa dicocokkan dari laptop.
