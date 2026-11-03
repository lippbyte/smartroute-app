# Runbook Demo Investor — SmartRoute AI

**Untuk:** presenter dan petugas teknis tim SmartRoute.
**Dasar angka:** pengukuran **31 Okt 2026** dengan kode app asli (`smartroute/scripts/measure-demo-flow.mts`) dan preflight (`npm run preflight`), backend bersih setelah restart. Detail mentah di bagian 8.
**Melengkapi:** `Runbook_Rehearsal_Demo_SmartRoute.md` (versi juri lomba, termasuk Model 0). Dokumen ini khusus alur investor 6–8 menit.

> **Status 3 Nov (setelah hotfix, cabang `feat/hotfix-scroll-bahasa`):** kunci OpenRouter dan IQAir **valid**. Pilihan lokasi kini bisa digulir (teruji di Chrome, **belum di HP**). **Untuk TOTO, pakai pertanyaan jam operasional** (10/10 benar); jawaban rute diarahkan ke pencarian rute, tetapi TOTO tetap bisa keliru (segmen 4). Tolak ajakan mencoba rute lewat TOTO.

> **Kode DIBEKUKAN sejak 31 Okt 2026 (keputusan Khalifa).** Yang boleh masuk hanya perbaikan yang menghalangi demo, masing-masing dengan uji dan regresi `/routes`. Tidak ada tag atau merge ke `main` sebelum hasil uji HP dari Khalifa.

Semua kalimat di kolom **"Kalimat kunci"** berstatus **perlu ditinjau presenter**: itu usulan, bukan naskah final.

---

## 1. Alur 6–8 menit

Durasi per segmen adalah **target**. Latensi sistem sudah diukur, tetapi waktu bicara dan mengetuk layar belum: `TODO:verifikasi` (ukur dengan stopwatch saat gladi pertama, lalu isi kolom "Terukur").

| # | Segmen | Target | Terukur (gladi) | Latensi sistem terukur |
|---|---|---|---|---|
| 1 | Beranda | 0:30 | `TODO:verifikasi` | — |
| 2 | S1 Blok M → Kota | 1:30 | `TODO:verifikasi` | 0,4–0,9 dtk per pencarian |
| 3 | S2 Pasar Baru → Lebak Bulus + lapor Monas | 2:00 | `TODO:verifikasi` | 1,4–1,7 dtk per pencarian; lapor < 0,1 dtk |
| 4 | TOTO | 1:00 | `TODO:verifikasi` | 2,3–2,9 dtk per jawaban (jam operasional) |
| 5 | Info aksesibilitas | 0:45 | `TODO:verifikasi` | 0,4–0,5 dtk |
| 6 | Trip Pass (simulasi) | 0:45 | `TODO:verifikasi` | 0 (tanpa jaringan) |
| 7 | Riwayat & rating | 0:45 | `TODO:verifikasi` | GET /trips < 0,1 dtk |
| 8 | Tentang | 0:30 | `TODO:verifikasi` | 0 (statis) |
| | **Total** | **7:45** | | |

**Angka yang dikutip.** Angka di bawah adalah yang terlihat saat **memilih saran teratas** di Beranda (Stasiun MRT Blok M → Halte TransJakarta Kota; Halte TransJakarta Pasar Baru → Stasiun MRT Lebak Bulus), diukur dengan jam Senin 21 Sep 2026 07:30. **Preflight dan regresi memakai titik baseline yang sedikit berbeda** (S1 rute "1" 92–106 mnt), jadi jangan mencocokkan keduanya. Hasil juga bergantung jam dan hari: selalu **baca angka dari layar**. Untuk S2, rute #1 *sesudah* lapor Monas bisa berbeda antarjam, karena itu kalimat kunci S2 sengaja tidak menyebut nama rute pengganti.

---

### Segmen 1 — Beranda (0:30)
- **Tekan:** buka app. Kalau muncul layar Masuk, pilih **akun demo** (dibutuhkan untuk TOTO dan Riwayat). Lihat bagian 5 soal tamu vs akun demo.
- **Harus muncul:** logo, kolom **Dari/Ke**, kartu **Peta Kepadatan**, dan kartu **Udara Jakarta** (data tingkat kota, berubah sesuai jam). Contoh terukur 3 Nov 05.32: **AQI 161, "Tidak sehat"**, saran "Pertimbangkan rute dengan jalan kaki lebih sedikit." Baca angkanya dari layar, jangan menghafal. Bila IQAir gagal, kartu tidak tampil tanpa galat.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "SmartRoute merencanakan perjalanan transportasi umum Jabodetabek dengan perkiraan yang jujur: rentang waktu, risiko sambungan, dan jejak karbon."
- **Cadangan:** app tidak terbuka → pakai video cadangan (bagian 6).

### Segmen 2 — S1 Blok M → Kota (1:30)
- **Tekan:** Dari: ketik "Blok M", pilih **Stasiun MRT Blok M**. Ke: ketik "Kota", pilih baris teratas **Halte TransJakarta Kota** (bukan "Kota Bambu" atau "Kota Kasablanka"). Lalu Cari. **⚠ Wajib memilih dari saran:** kalau hanya mengetik, "Kota" di-geocode ke titik di Jakarta Timur (-6,26; 106,88) dan hasilnya salah tujuan. Pastikan centang hijau muncul di field.
- **Harus muncul (4 kartu):**

| # | Rute | Label | Skor | Kartu (rentang ETA) | Transit | Tarif | CO₂ (estimasi) |
|---|---|---|---|---|---|---|---|
| 1 | Bus Koridor **1** | Murah | 6/10 | 88–102 mnt | 0x | Rp3.500 | ≈ 480 g · −81% vs mobil sendirian |
| 2 | **M+1** (MRT lalu Koridor 1) | Nyaman · lencana **Paling hijau** | 5/10 | 71–82 mnt | 1x | Rp11.500 | ≈ 380 g · −85% |
| 3 | M+Cikarang+Bogor | Nyaman · lencana **Minim paparan*** | 5/10 | 59–68 mnt | 2x | Rp10.000 | ≈ 630 g · −80% |
| 4 | M+Cikarang+Tanjungpriuk | Nyaman | 5/10 | 65–75 mnt | 2x | Rp10.000 | ≈ 610 g · −81% |

\* Lencana udara mengikuti AQI saat itu: udara kurang baik (terukur AQI 161) → "Minim paparan"; udara baik/sedang → "Aktif sehat" bila ada rute dengan jalan kaki 800–1.600 m. Bisa berbeda saat demo. Lencana "Paling hijau" (CO₂) tidak bergantung pada udara.

- **Rentang ETA langsung di kartu** (sejak keputusan Khalifa 31 Okt), mis. "88–102 mnt · 07:30–08:57". Diuji di layar 320/360/412 px dan dengan nama lokasi sangat panjang: tidak terpotong.
- **Ketuk kartu #1 → Detail:** kotak "Menit" di Detail masih **satu angka** (88, batas bawah), dan **Reliabilitas (Tepat Waktu) 90%**. Bandingkan dengan #3 (tercepat, 2 transit): reliabilitas **50%**. Itulah "risiko transfer" yang bisa ditunjukkan. Tunjuk rentang di kartu hasil, bukan di Detail.
- "Tingkat Kenyamanan" di Detail tertulis **"Data belum tersedia"**: memang belum ada datanya. Jangan diklaim.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Kami tidak menjanjikan satu angka: bus langsung 88 sampai 102 menit, Rp3.500, tanpa transit. Rute tercepat, 59 sampai 68 menit, punya dua kali transit dan reliabilitasnya hanya 50%." (Baca angkanya dari layar saat itu.)
- **Cadangan:** pencarian > 10 dtk → backend/OTP2 dingin; tunggu sekali (batas app 30 dtk). Kalau muncul "Layanan sedang tidak tersedia. Coba lagi sebentar lagi." → ketuk **Coba Lagi**. Masih gagal → petugas teknis menjalankan preflight; presenter lanjut ke video S1.
- **⚠ Urutan wajib:** S1 **sebelum** S2. Jangan ulang S1 dalam 15 menit sesudah S2 tanpa restart backend (laporan Monas menggeser S1: #1 menjadi M+Cikarang+Bogor).

### Segmen 3 — S2 Pasar Baru → Lebak Bulus, laporan Monas membalik rekomendasi (2:00)
- **Tekan (1):** Dari: pilih **Halte TransJakarta Pasar Baru**. Ke: pilih **Stasiun MRT Lebak Bulus** (saran teratas) → Cari.
- **Harus muncul (sebelum):** #1 **2+1+M** (bus via Monas, lalu MRT), 73–84 mnt, 2x transit, Rp17.500, skor 5/10.
- **Tekan (2):** kembali ke Beranda → **Peta Kepadatan** → **Lapor** → cari "Monumen Nasional" (muncul beberapa entri; pilih yang mana saja, semua peron digabung) → **Padat**.
- **Tekan (3):** cari ulang Pasar Baru → Lebak Bulus.
- **Harus muncul (sesudah):** rute via Monas **2+1+M turun ke #4** dengan label **PADAT** dan skor turun 5 → 3/10. Rute #1 berganti ke rute **KRL lalu MRT**:
  - Senin 07:30: **Bogor+Cikarang+M**, 71–82 mnt, Rp17.000.
  - Jam lain bisa berbeda: pada pengukuran Sabtu 20.07 (titik baseline), #1 menjadi Bogor+M.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Satu laporan pengguna bahwa halte Monas padat langsung mengubah rekomendasi. Rute via Monas turun ke paling bawah dan diberi label padat."
- **Cadangan:** urutan tidak berbalik → kemungkinan ada laporan sisa gladi atau jam berbeda. Petugas teknis restart backend (bagian 4), presenter memutar video S2. **Wajib ada video S2 cadangan.**

### Segmen 4 — TOTO, asisten AI (1:00)
- **Tekan:** masuk akun demo → TOTO → ketuk tombol saran **"Jam berapa TransJakarta mulai dan berhenti beroperasi?"**.
- **Harus muncul (10/10 percobaan, 2,3–2,9 dtk):** mayoritas rute sekitar 05:00–22:00 WIB, disebut rentang umum, beberapa rute berbeda. Kata-katanya berbeda tiap kali. Di atas kotak ketik tampil catatan tetap: "Jawaban TOTO bisa keliru. Untuk rute, waktu tempuh, dan transfer, gunakan pencarian rute."
- **⚠ Tombol tarif ("Berapa tarif TransJakarta?") bukan pilihan pertama:** Rp3.500 selalu benar, tetapi 5 dari 10 jawaban menyebut Transjabodetabek premium/lebih mahal, padahal di data 18 dari 18 rute Rp3.500. Kalau investor mengetuknya, sebut saja angka Rp3.500 dan transfer gratis 3 jam.
- **⚠ JANGAN pakai pertanyaan rute di depan investor.** Sejak hotfix, TOTO mengarahkannya ke pencarian rute (30/30) tanpa waktu tempuh atau transfer karangan, tetapi sebagian jawaban masih keliru:

| Pertanyaan | Hasil uji 5x per pertanyaan (3 Nov) |
|---|---|
| Rute antartempat (Blok M → Kota, Kalideres → PGC, Fatmawati → Manggarai, ke Monas) | 0 waktu tempuh karangan, 0 transfer karangan, 0 "real-time". Tetapi dengan GPS menyala 9/10 menyuruh menekan "Berangkat dari sini" padahal kartunya tidak muncul; Kalideres → PGC sekali menyebut nama rute dan sekali berjanji menjelaskan hasilnya |
| "Berapa lama perjalanannya dan apakah ramai?" | 5/5 berjanji "nanti saya bisa lihat hasilnya", padahal TOTO tidak melihat hasil pencarian |
| "Halte terdekat dari saya di mana?" | Nama & jarak benar 5/5, kartu halte tampil; 1/5 menawarkan "cari rute terbaik" |

- **Kalimat kunci** *(perlu ditinjau presenter)*: "TOTO menjawab pertanyaan umum soal layanan, dan kami tulis terang-terangan bahwa jawabannya bisa keliru. Untuk rute, sumber kebenarannya tetap mesin rute yang tadi Anda lihat."
- **Cadangan:** gagal/lambat > 15 dtk → katakan "asisten sedang tidak tersedia" dan lanjut; putar rekaman jawaban jam operasional bila ada (`TODO:verifikasi`: rekaman belum dibuat).

### Segmen 5 — Info aksesibilitas (0:45)
- **Persiapan:** Profil → **Tampilan & bantuan** → nyalakan **"Info aksesibilitas kursi roda"** (lakukan sebelum demo).
- **Tekan:** di hasil S1, nyalakan **"Tampilkan info aksesibilitas"**.
- **Harus muncul:** banner "Data aksesibilitas belum lengkap untuk sebagian halte/stasiun." Kartu #1 (Koridor 1): "1 titik tanpa data aksesibilitas. 1 titik tercatat bisa diakses kursi roda (menurut data GTFS). Data aksesibilitas armada tidak tersedia. Jalur jalan kaki belum dinilai." Semua kandidat S1 bertingkat keyakinan **"tidak diketahui"**. Urutan rute **tidak berubah**.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Kami tunjukkan apa yang tercatat dan apa yang belum. Data stasiun MRT, KRL, dan LRT serta armada memang belum tersedia, dan kami tidak menebaknya."
- **Cadangan:** toggle tidak muncul → bantuan belum dinyalakan di Profil; nyalakan, lalu cari ulang.

### Segmen 6 — Trip Pass, SIMULASI (0:45)
- **Tekan:** dari hasil S1, ketuk kartu **#2 M+1** → **Trip Pass**.
- **Harus muncul:** "Estimasi 71–82 mnt · 1x transit" (rentang yang sama dengan kartu hasil). Tarif per bagian: **MRT Blok M → Bundaran HI Rp8.000** + **TransJakarta 1 Rp3.500** = **Rp11.500**. Kartu berlabel **KARTU DEMO · SIMULASI**. Dengan saldo bawaan Rp10.000, status menjadi **kurang Rp1.500** → top-up simulasi Rp20.000 → cukup.
- **Kalimat kunci** *(perlu ditinjau presenter)*: "Penumpang tahu berapa yang ditap di tiap gerbang. Saldo dan top-up di sini masih simulasi; integrasi kartu sungguhan adalah rencana lewat kemitraan penerbit kartu."
- **Cadangan:** saldo di HP demo bukan Rp10.000 (bekas gladi) → **Ubah saldo awal simulasi** → 10000. Input negatif ditolak ("Saldo tidak boleh negatif.").

### Segmen 7 — Riwayat & rating (0:45)
- **Tekan:** menu → **Riwayat Perjalanan** → buka satu perjalanan → beri penilaian (bintang + "ETA sesuai?", "Risiko transfer sesuai?", "Kepadatan sesuai?").
- **Harus muncul:** riwayat akun demo. **Sejak 31 Okt riwayat ini KOSONG**: lima perjalanan uji "Blok M (uji CO₂) → Kota" sudah dihapus berdasarkan ID (keputusan Khalifa; cadangan `data/backups/smartroute-pre-hapus-uji-co2-20261031-202716.db`). **Saat gladi, buat 1–2 perjalanan sungguhan** lewat navigasi sampai Ringkasan Perjalanan, dan sisakan minimal satu yang belum dinilai untuk hari-H. Riwayat kosong di depan investor = segmen ini dilewati.
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
| **TOTO selalu akurat**, "tidak pernah mengarang", atau bisa dipakai merencanakan rute | Layar menulis: "TOTO paling akurat untuk tarif dan jam operasional; untuk rute gunakan pencarian rute." Jam operasional teruji 10/10; tarif Rp3.500 benar tetapi kategori bisa keliru; rute diarahkan ke pencarian rute (segmen 4) |
| Posisi armada / kepadatan **real-time** | Kepadatan dari **laporan pengguna**, berlaku 15 menit; jadwal dari GTFS dan jadwal rakitan tim |
| **Model prediksi terlatih** / "AI memprediksi waktu tempuh" | Rentang ETA dan skor rekomendasi berbasis **heuristik**; model prediksi ada di roadmap |
| Pembayaran, NFC, saldo, atau top-up **sungguhan** | Trip Pass: tarif per bagian nyata dari data tarif; saldo dan top-up **SIMULASI** di perangkat |
| Kerja sama, izin, atau dukungan dari **instansi/operator/bank** (TransJakarta, KAI, MRT, Pemprov, JAKI, penerbit kartu) | Belum ada; nama mereka hanya disebut sebagai **sumber data** |
| Data aksesibilitas **lengkap** | Hanya status halte TransJakarta dari GTFS, sebagian; MRT/KRL/LRT dan armada belum ada |
| Angka CO₂ sebagai **pengukuran** | **Estimasi** dari faktor emisi publik (lihat "Tentang angka ini") |
| "Rentang ETA di Detail perjalanan" | Rentang ada di kartu hasil, Trip Pass, Ringkasan, dan Riwayat; Detail menampilkan batas bawah |
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
- [ ] Preflight: baris TOTO dan "Kualitas udara" PASS (kunci terpasang 2 Nov; pastikan belum kedaluwarsa).
- [ ] Presenter berlatih segmen 4 dengan pertanyaan jam operasional, dan menyiapkan jawaban bila investor meminta mencoba rute lewat TOTO.
- [ ] Jalankan daftar cek HP di `Laporan_Hotfix_Scroll_TOTO.md` (gulir pilihan lokasi di Android/iOS).
- [ ] Gladi penuh dengan stopwatch dan isi kolom "Terukur" di bagian 1.
- [ ] Rekam **video cadangan** S1, S2 (dengan lapor Monas), dan TOTO jam operasional.
- [ ] Riwayat akun demo (kosong sejak 31 Okt) berisi 1–2 perjalanan gladi sungguhan, minimal satu belum dinilai (lihat segmen 7).
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
| Teks Transjabodetabek yang keliru di konteks TOTO, dan sisa jawaban TOTO yang keliru (lihat `Laporan_Hotfix_Scroll_TOTO.md`) | Keputusan Khalifa |
| Uji gulir pilihan lokasi & layar TOTO di HP | Tim HP |
| Kontak kemitraan resmi, tagline final | Khalifa |
| Durasi nyata tiap segmen | Tim (gladi) |
| Video cadangan S1/S2/TOTO | Tim |
| Uji tampilan HP (`cssInterop`) | Tim HP → keputusan Khalifa |
| Model bisnis untuk jawaban investor | Tim/Khalifa |
| Perjalanan gladi sungguhan di akun demo (riwayat kosong) | Tim (gladi) |

---

## 8. Data pengukuran

**3 Nov 2026 (setelah hotfix):**
- Preflight terakhir (07.37, backend bersih): **15 PASS · 0 WARN · 0 FAIL**; S1 #1 `1` 484 ms, S2 #1 `2+1+M` 1.550 ms, S3 #1 `3+8+5C` 2.643 ms; TOTO 3.857 ms (preflight kini memeriksa jawaban tarif memuat Rp3.500); kualitas udara `available: true, stale: false`.
- Saran teratas (`measure-demo-flow.mts`, kode app asli, jam Senin 07:30): S1 rute "1" 88–102 mnt, tercepat 59–68 mnt; S2 #1 2+1+M 73–84 mnt, sesudah Monas #1 Bogor+Cikarang+M 71–82 mnt dan 2+1+M turun ke #4 berlabel PADAT. Titik baseline: S1 rute "1" 92–106 mnt, S2 #1 76–88 mnt.
- TOTO, 12 pertanyaan x 5 (`test-toto-live.mjs`, jawaban dibaca manual): jam operasional 10/10 benar, 2,3–2,9 dtk; tarif 2,8–4,5 dtk.
- Regresi `/routes` bersih: S1, S2 sebelum/sesudah Monas, S3, L1, L2 **identik** baseline; chip moda 4/4.

**2–3 Nov 2026 (kunci baru, sebelum hotfix):**
- Pada 2 Nov, tepat setelah OTP2 menyala, S1 sempat WARN (dingin 18,7 dtk).
- Udara: AQI 105 (2 Nov malam), AQI 161 "Tidak sehat" (3 Nov 05.32).
- Regresi `/routes` bersih setelah restart (3 Nov): S1, S2 sebelum/sesudah Monas, S3, L1, L2 **identik** baseline; chip moda 4/4; tata letak kartu dengan data udara asli 34/34.

**31 Okt 2026:**

**Preflight** (backend baru di-restart, ±20.06 WIB): 13 PASS · 1 WARN · 1 FAIL.
- PASS: backend lokal 53 ms, tunnel 434 ms, OTP2 4 feed 19 ms, laporan kepadatan 0, S1 #1 `1` 868 ms, S2 #1 `2+1+M` 1.688 ms, S3 #1 `3+8+5C` 2.665 ms, akun demo masuk 54 ms, `/me`, `/trips` (4 perjalanan), keluar, database `quick_check ok`, cadangan dibuat.
- WARN: kualitas udara `available: false, stale: false` (IQAIR_API_KEY tidak ada).
- FAIL: TOTO, HTTP 502; kunci OpenRouter **ada · KEDALUWARSA**.

**Pengukuran layar** (`measure-demo-flow.mts`, kode app asli):
- Jam terkunci Senin 21 Sep 07:30: S1 477 ms, S1+aksesibilitas 494 ms, S2 sebelum 1.524 ms, lapor Monas 2 ms, S2 sesudah 1.424 ms.
- Sekarang (Sabtu 31 Okt 20.07): S1 549 ms (urutan dan angka sama dengan jam terkunci), S2 sebelum 1.518 ms (#1 2+1+M), S2 sesudah 1.405 ms (#1 **Bogor+M**, bukan Bogor+Cikarang+M).
- Regresi `/routes` hari ini: S1, S2 sebelum/sesudah Monas, S3, L1, L2 **identik** dengan baseline Hari 3.
