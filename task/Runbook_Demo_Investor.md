# Runbook Demo Investor — SmartRoute AI

**Untuk:** presenter dan petugas teknis tim SmartRoute.
**Dasar angka:** pengukuran **31 Okt 2026** dengan kode app asli (`smartroute/scripts/measure-demo-flow.mts`) dan preflight (`npm run preflight`), backend bersih setelah restart. Detail mentah di bagian 8.
**Melengkapi:** `Runbook_Rehearsal_Demo_SmartRoute.md` (versi juri lomba, termasuk Model 0). Dokumen ini khusus alur investor 6–8 menit.

> **Status hari ini (31 Okt):** kunci OpenRouter **kedaluwarsa**, jadi TOTO belum bisa didemokan. Kunci IQAir **tidak ada**, jadi kartu udara dan lencana udara ("Aktif sehat"/"Minim paparan") tidak tampil; lencana "Paling hijau" (CO₂) tetap tampil. Keduanya menunggu Khalifa. Semua yang lain PASS di preflight.

Semua kalimat di kolom **"Kalimat kunci"** berstatus **perlu ditinjau presenter**: itu usulan, bukan naskah final.

---

## 1. Alur 6–8 menit

Durasi per segmen adalah **target**. Latensi sistem sudah diukur, tetapi waktu bicara dan mengetuk layar belum: `TODO:verifikasi` (ukur dengan stopwatch saat gladi pertama, lalu isi kolom "Terukur").

| # | Segmen | Target | Terukur (gladi) | Latensi sistem terukur |
|---|---|---|---|---|
| 1 | Beranda | 0:30 | `TODO:verifikasi` | — |
| 2 | S1 Blok M → Kota | 1:30 | `TODO:verifikasi` | 0,4–0,9 dtk per pencarian |
| 3 | S2 Pasar Baru → Lebak Bulus + lapor Monas | 2:00 | `TODO:verifikasi` | 1,4–1,7 dtk per pencarian; lapor < 0,1 dtk |
| 4 | TOTO | 1:00 | `TODO:verifikasi` | belum bisa diukur (kunci kedaluwarsa) |
| 5 | Info aksesibilitas | 0:45 | `TODO:verifikasi` | 0,4–0,5 dtk |
| 6 | Trip Pass (simulasi) | 0:45 | `TODO:verifikasi` | 0 (tanpa jaringan) |
| 7 | Riwayat & rating | 0:45 | `TODO:verifikasi` | GET /trips < 0,1 dtk |
| 8 | Tentang | 0:30 | `TODO:verifikasi` | 0 (statis) |
| | **Total** | **7:45** | | |

**Jam berangkat.** Hasil rute bergantung jam dan hari. Angka di bawah memakai **Senin 21 Sep 2026 07:30** (jam terkunci, sama dengan baseline dan preflight). Untuk S1, hasil "sekarang" (Sabtu 31 Okt 20.07) **sama persis**. Untuk S2, rute #1 *sesudah* lapor Monas **berbeda** antarjam (lihat segmen 3). Karena itu, kalimat kunci S2 sengaja tidak menyebut nama rute pengganti.

---

### Segmen 1 — Beranda (0:30)
- **Tekan:** buka app. Kalau muncul layar Masuk, pilih **akun demo** (dibutuhkan untuk TOTO dan Riwayat). Lihat bagian 5 soal tamu vs akun demo.
- **Harus muncul:** logo, kolom **Dari/Ke**, kartu **Peta Kepadatan**. Kartu kualitas udara **tidak tampil** selama kunci IQAir tidak ada; ini memang perilaku yang dirancang, bukan galat.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "SmartRoute merencanakan perjalanan transportasi umum Jabodetabek dengan perkiraan yang jujur: rentang waktu, risiko sambungan, dan jejak karbon."
- **Cadangan:** app tidak terbuka → pakai video cadangan (bagian 6).

### Segmen 2 — S1 Blok M → Kota (1:30)
- **Tekan:** Dari "Blok M", Ke "Kota" (pilih dari saran) → Cari.
- **Harus muncul (4 kartu):**

| # | Rute | Label | Skor | Kartu | Transit | Tarif | CO₂ (estimasi) |
|---|---|---|---|---|---|---|---|
| 1 | Bus Koridor **1** | Murah | 6/10 | 92 mnt | 0x | Rp3.500 | ≈ 480 g · −81% vs mobil sendirian |
| 2 | **M+1** (MRT lalu Koridor 1) | Nyaman · lencana **Paling hijau** | 5/10 | 75 mnt | 1x | Rp11.500 | ≈ 380 g · −85% |
| 3 | M+Cikarang+Bogor | Nyaman | 5/10 | 64 mnt | 2x | Rp10.000 | ≈ 630 g · −81% |
| 4 | M+Bogor | Nyaman | 4/10 | 74 mnt | 1x | Rp11.000 | ≈ 380 g · −86% |

- **Ketuk kartu #1 → Detail:** "92 Menit", **Reliabilitas (Tepat Waktu) 90%**. Bandingkan dengan #3 (tercepat, 2 transit): reliabilitas **50%**. Itulah "risiko transfer" yang bisa ditunjukkan.
- **Penting, jangan salah tunjuk:** kartu hasil dan Detail menampilkan **satu angka** (batas bawah, mis. 92 mnt). **Rentang** (92–106 mnt) baru tampil di **Trip Pass** ("Estimasi 92–106 mnt"), **Ringkasan Perjalanan**, dan **Riwayat** ("Prediksi A–B mnt"). Rentang ini ditunjukkan di segmen 6. Menampilkan rentang di kartu hasil adalah keputusan Khalifa (bukan perbaikan Hari 4).
- "Tingkat Kenyamanan" di Detail tertulis **"Data belum tersedia"**: memang belum ada datanya. Jangan diklaim.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Rute tercepat belum tentu yang kami sarankan. Yang 64 menit punya dua kali transit dan reliabilitasnya 50%, sedangkan bus langsung 92 menit, Rp3.500, tanpa transit."
- **Cadangan:** pencarian > 10 dtk → backend/OTP2 dingin; tunggu sekali (batas app 30 dtk). Kalau muncul "Layanan sedang tidak tersedia. Coba lagi sebentar lagi." → ketuk **Coba Lagi**. Masih gagal → petugas teknis menjalankan preflight; presenter lanjut ke video S1.
- **⚠ Urutan wajib:** S1 **sebelum** S2. Jangan ulang S1 dalam 15 menit sesudah S2 tanpa restart backend (laporan Monas menggeser S1: #1 menjadi M+Cikarang+Bogor).

### Segmen 3 — S2 Pasar Baru → Lebak Bulus, laporan Monas membalik rekomendasi (2:00)
- **Tekan (1):** Dari "Pasar Baru", Ke "Lebak Bulus" → Cari.
- **Harus muncul (sebelum):** #1 **2+1+M** (bus via Monas, lalu MRT), 76 mnt, 2x transit, Rp17.500, skor 5/10.
- **Tekan (2):** kembali ke Beranda → **Peta Kepadatan** → **Lapor** → cari "Monumen Nasional" (muncul beberapa entri; pilih yang mana saja, semua peron digabung) → **Padat**.
- **Tekan (3):** cari ulang Pasar Baru → Lebak Bulus.
- **Harus muncul (sesudah):** rute via Monas **2+1+M turun ke #4** dengan label **PADAT** dan skor turun 5 → 3/10. Rute #1 berganti ke rute **KRL lalu MRT**:
  - Senin 07:30: **Bogor+Cikarang+M**, 73 mnt, Rp17.000.
  - Sabtu 20.07: **Bogor+M**, 77 mnt, Rp17.000, lencana Paling hijau.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Satu laporan pengguna bahwa halte Monas padat langsung mengubah rekomendasi. Rute via Monas turun ke paling bawah dan diberi label padat."
- **Cadangan:** urutan tidak berbalik → kemungkinan ada laporan sisa gladi atau jam berbeda. Petugas teknis restart backend (bagian 4), presenter memutar video S2. **Wajib ada video S2 cadangan.**

### Segmen 4 — TOTO, asisten AI (1:00)
- **Status 31 Okt:** **tidak bisa didemokan**. Kunci OpenRouter kedaluwarsa, sehingga app menampilkan "Layanan asisten sedang tidak tersedia. Coba lagi sebentar lagi." (pesan ramah; tidak memakan kuota akun karena 401 dikembalikan).
- **Setelah kunci baru dipasang:** masuk akun demo → TOTO → tanya pertanyaan terlatih **"dari Blok M ke Kota naik apa?"** (Q1). Jawaban yang diharapkan menyebut Rute 1 (BRT) dan Rp3.500. Latensi: `TODO:verifikasi` (ukur ulang 5 pertanyaan setelah kunci baru).
- **Hindari Q5** ("Berapa lama perjalanannya dan apakah ramai?"): tercatat sebagai risiko sejak Hari 1.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "TOTO menjawab dari data transit yang kami berikan, bukan dikarang. Kalau datanya tidak ada, TOTO bilang tidak tahu."
- **Cadangan:** gagal/lambat > 15 dtk → katakan "asisten sedang tidak tersedia" dan lanjut; putar rekaman jawaban Q1 bila ada (`TODO:verifikasi`: rekaman belum dibuat).

### Segmen 5 — Info aksesibilitas (0:45)
- **Persiapan:** Profil → **Tampilan & bantuan** → nyalakan **"Info aksesibilitas kursi roda"** (lakukan sebelum demo).
- **Tekan:** di hasil S1, nyalakan **"Tampilkan info aksesibilitas"**.
- **Harus muncul:** banner "Data aksesibilitas belum lengkap untuk sebagian halte/stasiun." Kartu #1 (Koridor 1): "1 titik tanpa data aksesibilitas. 1 titik tercatat bisa diakses kursi roda (menurut data GTFS). Data aksesibilitas armada tidak tersedia. Jalur jalan kaki belum dinilai." Semua kandidat S1 bertingkat keyakinan **"tidak diketahui"**. Urutan rute **tidak berubah**.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Kami tunjukkan apa yang tercatat dan apa yang belum. Data stasiun MRT, KRL, dan LRT serta armada memang belum tersedia, dan kami tidak menebaknya."
- **Cadangan:** toggle tidak muncul → bantuan belum dinyalakan di Profil; nyalakan, lalu cari ulang.

### Segmen 6 — Trip Pass, SIMULASI (0:45)
- **Tekan:** dari hasil S1, ketuk kartu **#2 M+1** → **Trip Pass**.
- **Harus muncul:** "Estimasi 75–87 mnt · 1x transit" (di sinilah rentang ETA tampil). Tarif per bagian: **MRT Blok M → Bundaran HI Rp8.000** + **TransJakarta 1 Rp3.500** = **Rp11.500**. Kartu berlabel **KARTU DEMO · SIMULASI**. Dengan saldo bawaan Rp10.000, status menjadi **kurang Rp1.500** → top-up simulasi Rp20.000 → cukup.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Penumpang tahu berapa yang ditap di tiap gerbang. Saldo dan top-up di sini masih simulasi; integrasi kartu sungguhan adalah rencana lewat kemitraan penerbit kartu."
- **Cadangan:** saldo di HP demo bukan Rp10.000 (bekas gladi) → **Ubah saldo awal simulasi** → 10000. Input negatif ditolak ("Saldo tidak boleh negatif.").

### Segmen 7 — Riwayat & rating (0:45)
- **Tekan:** menu → **Riwayat Perjalanan** → buka satu perjalanan → beri penilaian (bintang + "ETA sesuai?", "Risiko transfer sesuai?", "Kepadatan sesuai?").
- **Harus muncul:** riwayat akun demo. **⚠ 31 Okt: berisi 5 perjalanan, semuanya data uji "Blok M (uji CO₂) → Kota"** (dibuat uji Hari 2, yang sejak Hari 4 tidak lagi memakai akun demo), 0 sudah dinilai. **Jangan didemokan apa adanya.** Keputusan Khalifa: hapus kelima perjalanan uji (cadangan DB ada di `data/backups/`), lalu saat gladi buat 1–2 perjalanan sungguhan lewat navigasi sampai Ringkasan Perjalanan.
- **⚠ Satu rating per perjalanan, permanen.** Setiap gladi yang menilai menghabiskan satu perjalanan. Sisakan minimal satu perjalanan belum dinilai untuk hari-H. Jangan menilai saat gladi, atau buat perjalanan baru lewat navigasi sampai Ringkasan Perjalanan.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Penilaian pengguna mengukur apakah perkiraan kami tepat; ini dasar untuk memperbaiki prediksi nanti."
- **Cadangan:** sesi kedaluwarsa → app mengarahkan ke Masuk dengan pesan jelas; masuk ulang akun demo.

### Segmen 8 — Tentang (0:30)
- **Tekan:** ikon gelembung chat di kanan atas.
- **Harus muncul:** nilai produk, fitur, **Transparansi data** per sumber, **Status prototipe** ("Pembayaran dan saldo kartu di Trip Pass masih SIMULASI"), **Rencana pengembangan (belum tersedia)**, form masukan. Bagian Kemitraan **tidak tampil** selama kontak resmi belum diisi (`TODO:isi`, Khalifa).
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Kami tulis terang-terangan mana yang sudah jalan, mana yang simulasi, dan mana yang masih rencana."

---

## 2. Jangan diklaim

| Jangan katakan | Yang benar |
|---|---|
| Posisi armada / kepadatan **real-time** | Kepadatan dari **laporan pengguna**, berlaku 15 menit; jadwal dari GTFS dan jadwal rakitan tim |
| **Model prediksi terlatih** / "AI memprediksi waktu tempuh" | Rentang ETA dan skor rekomendasi berbasis **heuristik**; model prediksi ada di roadmap |
| Pembayaran, NFC, saldo, atau top-up **sungguhan** | Trip Pass: tarif per bagian nyata dari data tarif; saldo dan top-up **SIMULASI** di perangkat |
| Kerja sama, izin, atau dukungan dari **instansi/operator/bank** (TransJakarta, KAI, MRT, Pemprov, JAKI, penerbit kartu) | Belum ada; nama mereka hanya disebut sebagai **sumber data** |
| Data aksesibilitas **lengkap** | Hanya status halte TransJakarta dari GTFS, sebagian; MRT/KRL/LRT dan armada belum ada |
| Angka CO₂ sebagai **pengukuran** | **Estimasi** dari faktor emisi publik (lihat "Tentang angka ini") |
| "Rentang ETA di setiap kartu hasil" | Kartu menampilkan satu angka; rentang ada di Trip Pass/Ringkasan/Riwayat |
| "Tingkat kenyamanan" | Detail menampilkan "Data belum tersedia" |
| Kualitas udara / lencana "Aktif sehat" atau "Minim paparan" sebagai saran kesehatan | Hanya bila kunci IQAir terpasang dan data tidak basi; data tingkat **kota**, bukan per halte; lencana bersifat info, bukan saran medis |

---

## 3. Pertanyaan sulit & jawaban jujur *(perlu ditinjau presenter)*

- **Sumber datanya dari mana?** TransJakarta: GTFS resmi operator (rute, jadwal, tarif, status kursi roda halte). KRL, MRT, LRT: jadwal dirakit tim; tarif KRL dan LRT dari matriks resmi operator, tarif MRT dari sumber sekunder dan masih diverifikasi. Kepadatan dari laporan pengguna. Mesin rute OpenTripPlanner 2, peta OpenStreetMap/OpenFreeMap.
- **Seberapa akurat ETA-nya?** Belum diukur terhadap perjalanan nyata dalam jumlah besar. Itulah gunanya rating "ETA sesuai?" di riwayat. Kami menampilkan rentang, bukan satu angka pasti.
- **Data aksesibilitas pengguna aman?** Profil aksesibilitas opsional dan butuh persetujuan; bisa dihapus dari Profil. TOTO hanya menerima nama panggilan dan prioritas, bukan email, profil aksesibilitas, atau riwayat (diuji Hari 1).
- **Model bisnisnya?** `TODO:verifikasi`: belum ada keputusan tim yang bisa saya rujuk. Jangan dijawab dengan angka.
- **Apa bedanya dengan aplikasi resmi?** Lintas operator dalam satu pencarian, rentang ETA dan reliabilitas sambungan, laporan kepadatan komunitas yang mengubah rekomendasi, dan transparansi data. Jangan menyebut aplikasi resmi "salah" atau "kalah".
- **Apa yang belum ada?** Data armada real-time, model prediksi, pembayaran sungguhan, data aksesibilitas stasiun, integrasi JAKI (semua di roadmap layar Tentang).
- **Berapa pengguna sekarang?** Prototipe; belum ada pilot publik. Jangan menyebut angka akun dari database uji.

---

## 4. Daftar periksa

### H-1
- [ ] **Kunci OpenRouter baru** dipasang di `backend/backend-skeleton/.env` oleh Khalifa, lalu restart backend. Preflight baris TOTO harus PASS.
- [ ] **Kunci IQAir** (bila dipakai) dipasang; preflight "Kualitas udara" `available: true`.
- [ ] Ukur ulang 5 pertanyaan TOTO dan isi latensi segmen 4.
- [ ] Gladi penuh dengan stopwatch dan isi kolom "Terukur" di bagian 1.
- [ ] Rekam **video cadangan** S1, S2 (dengan lapor Monas), dan TOTO Q1.
- [ ] Riwayat akun demo **bersih dari perjalanan uji** "Blok M (uji CO₂)" (lihat segmen 7) dan berisi 1–2 perjalanan gladi sungguhan.
- [ ] HP demo: bantuan "Info aksesibilitas kursi roda" **menyala**; saldo Trip Pass = Rp10.000; minimal satu perjalanan **belum dinilai** di akun demo.
- [ ] Uji tampilan di HP (dampak `cssInterop` pada teks); keputusan Khalifa bila bermasalah.

### Pagi hari-H (urut)
1. Docker → OTP2 (tunggu graph termuat).
2. Backend: `cd backend/backend-skeleton; npm run dev`.
3. Tunnel ngrok (URL tetap, sama dengan `DEMO_TUNNEL_URL`).
4. Metro HP dengan `EXPO_PUBLIC_API_BASE_URL` = URL tunnel.
5. **Restart backend** sesudah gladi terakhir (menghapus laporan Monas), lalu:
   ```powershell
   cd backend/backend-skeleton; npm run preflight
   ```
   Target: **tanpa FAIL**; "Laporan kepadatan aktif: 0 (bersih)"; S1 #1 `1`, S2 #1 `2+1+M`, S3 #1 `3+8+5C`. Preflight sekaligus memanaskan OTP2 dan membuat cadangan database.
6. Baterai HP ≥ 80%, mode jangan-ganggu, hotspot cadangan siap.
7. **Akun demo vs tamu:** pakai akun demo (TOTO dan Riwayat butuh masuk). Kredensial di `data/demo-account.local.json`; **jangan tampil di layar/projector**.

### Restart aman (hanya port backend)
```powershell
(Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess | % { taskkill /PID $_ /T /F }
npm run dev
```
Akun, riwayat, dan rating tersimpan di SQLite, tidak ikut terhapus. Tunnel dan Metro tidak perlu di-restart.

---

## 5. Pesan galat yang mungkin terlihat (sudah ramah sejak Hari 4)

| Kondisi | Yang dilihat penonton | Tindakan |
|---|---|---|
| Backend mati / tunnel putus / agen ngrok mati | "Tidak bisa menghubungi server. Periksa koneksi internet Anda, lalu coba lagi." + **Coba Lagi** | Petugas: preflight, nyalakan yang FAIL |
| OTP2 mati | "Layanan rute sedang tidak tersedia. Coba lagi sebentar lagi." + **Coba Lagi** | Petugas: nyalakan container OTP2 |
| Pencarian > 30 dtk | "Pencarian rute terlalu lama dan dihentikan. Coba lagi." | Ulangi sekali |
| TOTO gagal | "Layanan asisten sedang tidak tersedia. Coba lagi sebentar lagi." | Lewati segmen |
| Izin lokasi ditolak (navigasi) | "Izin lokasi ditolak, jadi geser langkah dengan tombol di bawah." | Pakai tombol langkah |

---

## 6. Rencana cadangan umum
- Video rekaman alur penuh (wajib untuk S2; `TODO:verifikasi`: belum dibuat).
- Satu orang khusus memegang laptop/teknis, bukan presenter.
- Bila backend tidak pulih dalam 1 menit: lanjut ke video, jangan debug di depan investor.

---

## 7. Yang masih menunggu
| Butir | Siapa |
|---|---|
| Kunci OpenRouter baru (TOTO) | Khalifa |
| Kunci IQAir (kartu udara, lencana Aktif sehat/Minim paparan) | Khalifa |
| Kontak kemitraan resmi, tagline final | Khalifa |
| Durasi nyata tiap segmen | Tim (gladi) |
| Video cadangan S1/S2/TOTO | Tim |
| Uji tampilan HP (`cssInterop`) | Tim HP → keputusan Khalifa |
| Model bisnis untuk jawaban investor | Tim/Khalifa |
| Rentang ETA di kartu hasil (saat ini hanya batas bawah) | Keputusan Khalifa |
| Hapus 5 perjalanan uji "Blok M (uji CO₂)" dari akun demo | Keputusan Khalifa |

---

## 8. Data pengukuran 31 Okt 2026

**Preflight** (backend baru di-restart, ±20.06 WIB): 13 PASS · 1 WARN · 1 FAIL.
- PASS: backend lokal 53 ms, tunnel 434 ms, OTP2 4 feed 19 ms, laporan kepadatan 0, S1 #1 `1` 868 ms, S2 #1 `2+1+M` 1.688 ms, S3 #1 `3+8+5C` 2.665 ms, akun demo masuk 54 ms, `/me`, `/trips` (4 perjalanan), keluar, database `quick_check ok`, cadangan dibuat.
- WARN: kualitas udara `available: false, stale: false` (IQAIR_API_KEY tidak ada).
- FAIL: TOTO, HTTP 502; kunci OpenRouter **ada · KEDALUWARSA**.

**Pengukuran layar** (`measure-demo-flow.mts`, kode app asli):
- Jam terkunci Senin 21 Sep 07:30: S1 477 ms, S1+aksesibilitas 494 ms, S2 sebelum 1.524 ms, lapor Monas 2 ms, S2 sesudah 1.424 ms.
- Sekarang (Sabtu 31 Okt 20.07): S1 549 ms (urutan dan angka sama dengan jam terkunci), S2 sebelum 1.518 ms (#1 2+1+M), S2 sesudah 1.405 ms (#1 **Bogor+M**, bukan Bogor+Cikarang+M).
- Regresi `/routes` hari ini: S1, S2 sebelum/sesudah Monas, S3, L1, L2 **identik** dengan baseline Hari 3.
