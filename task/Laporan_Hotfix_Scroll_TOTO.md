# Laporan Hotfix — Gulir Pemilih Lokasi dan Perbaikan TOTO

**Cabang:** `feat/hotfix-scroll-bahasa`, dari `3899042`. **Tidak di-merge ke `main`, tidak ada tag.**
**Tanggal:** 3 Nov 2026. Tanpa rebuild, tanpa paket baru, `Text.tsx` tidak diubah.
**Belum diuji di HP.** Gestur diuji di Chrome headless dengan sentuhan sintetis (CDP). Daftar cek HP ada di bagian 5.

## 1. Ringkasan

| Pekerjaan | Status | Commit |
|---|---|---|
| Task A: jari yang menggulir tidak lagi memilih opsi | Selesai (kode & web) | `445d509` |
| Task A: dialog Tujuan Cepat & Lapor Kepadatan bisa digulir | Selesai (kode & web) | `3cd0b74` |
| TOTO (1): dua tombol saran aman, tombol buka rute dihapus | Selesai | `439558a` |
| TOTO (2): label keandalan terbalik | Selesai | `7b939bb` |
| TOTO (3): ganti klaim "bukan dikarang" | Selesai | `7b75816` |
| TOTO (4): instruksi anti-mengarang, uji 5x per pertanyaan | Selesai; masih ada jawaban keliru | `080de80` |
| TOTO: catatan tetap di layar (karena masih ada yang keliru) | Selesai | `bc14276` |
| Task B: bahasa ID/EN | **Tidak dikerjakan** (sesuai keputusan). 0 layar diterjemahkan | — |
| Bagian Kemitraan di layar Tentang | **Tidak diubah**, menunggu konfirmasi Khalifa | — |

## 2. Task A: akar masalah gulir

| Lokasi | Mekanisme | Sebelum (kode lama, sentuhan) | Sesudah |
|---|---|---|---|
| `LocationAutocompleteField.tsx:170` (Dari/Tujuan di Beranda) | Memilih lewat `onPressIn`, yaitu saat jari **menyentuh** | Jari yang hendak menggulir langsung memilih: field berubah menjadi "Halte JakLingko Monumen Pancasila Sakti 2", dropdown tertutup | Field tetap "Monumen", daftar tergulir, ketuk memilih item yang benar dan koordinatnya dipakai Cari Rute |
| `all-stops-map.tsx:116` | Sama | Field menjadi "Pasar Genjing", dropdown tertutup | Sama seperti di atas, 20 baris |
| `QuickLocationPickerModal.tsx:91` (Tujuan Cepat) | `View` dengan `maxHeight`, bukan `ScrollView` | Tidak ada area gulir, baris terpotong | `ScrollView`, baris terakhir tercapai |
| `CrowdReportModal.tsx:148` (Lapor Kepadatan, alur demo S2) | Sama | 8 hasil "Monumen" terpotong | `ScrollView`, baris terakhir tercapai |

Bug ini tidak terlihat di web dengan roda mouse, dan RN Web menunda `pressIn` 50 ms (native 0 ms). `onPressIn` dulu dipasang untuk menghindari balapan timer blur 150 ms (dilaporkan 23 Sep). Balapan itu kini ditangani penanda "baris sedang ditekan": selama ditekan, blur tidak menutup dropdown. Tahan 600 ms lalu lepas tetap memilih (A8, D5).

**Tes lulus Task A:** `test-location-picker-scroll.mjs` 33/33 (sentuhan: drag, ketuk, tahan; mouse: roda, klik lambat; layar pendek 420 px; ketuk di luar, tombol hapus, ketik ulang). Daftar saran dibatasi hook ke 8 baris (4 halte + 4 alamat), jadi uji >10 opsi dilakukan di Peta Semua Halte (20 baris).

## 3. TOTO

**Yang dikerjakan di luar daftar, perlu diketahui:**
- **Penguraian "dari X ke Y" dan geocode di layar TOTO ikut dihapus.** Kalau hanya tombolnya yang dihapus, app tetap mengirim koordinat keliru ("Kota" → Jakarta Timur) ke LLM sebagai data rute. API backend tidak berubah.
- **Klaim yang sama di dua tempat lain ikut diganti** dengan teks jujur yang sama: kartu TOTO di Beranda ("dijawab dari data transit asli") dan pembuka layar TOTO ("bukan mengarang").
- Preflight kini memakai pertanyaan tarif dan memeriksa jawaban memuat Rp3.500. Tombol saran dibuat bisa membungkus karena pertanyaan jam operasional keluar dari tepi layar.

**Label keandalan:** prompt yang terkirim dicocokkan dengan `/routes` (`test-toto-grounding.mjs`, provider tiruan): sebelum "keandalan sambungan: low", sesudah "risiko sambungan: rendah". Di uji live, 0/5 terbalik.

**Hasil uji jawaban asli: 12 pertanyaan x 5 = 60 jawaban** (`test-toto-live.mjs`, instance terpisah, kuota akun demo tidak terpakai). Semua jawaban dibaca manual dan cocok dengan penyaring: **31 bersih, 29 masih ada yang keliru.**

| Pertanyaan | Bersih | Yang masih keliru |
|---|---|---|
| Jam operasional | 5/5 | — |
| Jam operasional + GPS | 5/5 | — |
| Tarif | 2/5 | 3x menyebut Transjabodetabek premium |
| Tarif + GPS | 2/5 | 2x Transjabodetabek premium, 1x tanpa Rp35.000 |
| Blok M → Kota | 4/5 | 1x tombol yang tidak ada |
| Blok M → Kota + GPS | 0/5 | 5x tombol yang tidak ada |
| Kalideres → PGC | 3/5 | 1x menyebut nama rute, 1x janji palsu |
| Fatmawati → Manggarai | 5/5 | — |
| Ke Monas + GPS | 1/5 | 4x tombol yang tidak ada |
| Lama perjalanan (tanpa konteks) | 0/5 | 5x janji palsu "nanti saya bisa lihat hasilnya" |
| Lama perjalanan (dengan konteks; hanya API, app tidak lagi mengirimnya) | 0/5 | 5x "tercepat" keliru, 4x fitur yang tidak ada, 3x tombol yang tidak ada. Angka 5/5 benar, keandalan 0/5 terbalik |
| Halte terdekat + GPS | 4/5 | 1x menawarkan "cari rute terbaik". Nama & jarak 5/5 benar |

**Yang berhasil:** pada 30 jawaban pertanyaan rute tanpa data, **0 waktu tempuh karangan, 0 transfer karangan, 0 "real-time"**, dan 30/30 mengarahkan ke pencarian rute. Sebelum instruksi (Q1 dikirim seperti dari app, 3x): waktu tempuh karangan 2/3, "tercepat" 3/3, "real-time" 2/3; Q4 mengarang transfer Rute 3 → Rute 10.

**Sesuai keputusan, instruksi tidak ditambal lagi.** Catatan tetap ditambahkan di atas kotak ketik: "Jawaban TOTO bisa keliru. Untuk rute, waktu tempuh, dan transfer, gunakan pencarian rute."

**Dua koreksi atas laporan sebelumnya:**
- Saya menyebut pertanyaan tarif "aman 3/3". Itu terlalu longgar karena hanya memeriksa angka Rp. Dengan 10 percobaan dan dicocokkan ke GTFS, 5/10 keliru soal Transjabodetabek. Runbook kini memakai **jam operasional** sebagai pertanyaan terlatih.
- **Angka di runbook sebelumnya bukan angka yang terlihat presenter.** Tabel memakai titik baseline regresi, sedangkan di layar presenter memilih saran teratas: rute "1" 88–102 mnt (bukan 92–106), tercepat 59–68 (bukan 64–74), kandidat #4 berbeda. Urutan #1 dan pembalikan S2 tetap sama. Runbook kini mengutip angka saran teratas, termasuk kalimat kuncinya.

## 4. Menunggu keputusan Khalifa

1. **Teks Transjabodetabek keliru** di `backend/backend-skeleton/src/services/gtfsContext.ts:39`: menyebutnya tarif premium, padahal GTFS 18/18 rute Rp3.500. Inilah penyebab kekeliruan tarif, dan layar menulis TOTO "paling akurat untuk tarif". Usul: hapus "Transjabodetabek" dari kalimat itu (satu kata, perbaikan fakta). Belum dikerjakan karena keputusan "jangan menambal lagi". **Disarankan diizinkan.**
2. **Tombol yang tidak ada** ("Berangkat dari sini" tanpa kartu; 10 jawaban rute) dan **janji palsu** ("nanti saya bisa lihat hasilnya"; 6 jawaban rute): bersumber dari kalimat lama di instruksi sistem. Hanya bisa diperbaiki dengan mengubah prompt.
3. **Geocode nama pendek di Hasil Rute:** bila pengguna mengetik "Kota" tanpa memilih saran, tujuan meleset ke Jakarta Timur (`route/index.tsx:516-517`). Tidak diubah; runbook mewajibkan memilih dari saran.
4. **Web saja:** di bawah lebar 402 px, layar TOTO dan Tentang bisa digeser horizontal karena gambar latar `ScreenBackground`. Sudah ada sebelum hotfix, bukan jalur demo HP. Tidak diubah.
5. **Bagian Kemitraan:** menunggu konfirmasi.
6. **Tag `demo-candidate-1` dan merge:** menunggu hasil uji HP. Tag kini sebaiknya pada HEAD cabang ini, bila cabang ini diterima.

## 5. Daftar cek HP (Android dan iOS bila ada)

Belum ada satu pun yang diuji di perangkat. Yang paling penting ditandai ★.

**Beranda, field Dari/Tujuan** (ketik "Monumen", tunggu daftar)
- [ ] ★ Usap ke atas mulai dari tengah daftar: daftar bergulir, teks field **tetap** "Monumen", daftar tidak tertutup.
- [ ] ★ Gulir saat keyboard terbuka, lalu ketuk item di tengah: item itu yang terpilih, centang hijau muncul, keyboard tertutup.
- [ ] Tutup keyboard dulu (tombol kembali di Android), lalu gulir dan ketuk: tetap berfungsi.
- [ ] Tahan item 1 detik lalu lepas: tetap memilih.
- [ ] Mulai usap lalu lepas tanpa memilih, kemudian ketuk di luar daftar: daftar tertutup, teks tidak berubah.
- [ ] Android: usapan di dalam daftar tidak ikut menggeser halaman Beranda.
- [ ] Mengetik, autocomplete, tombol hapus (X), dan tukar asal-tujuan tetap normal.

**Dialog Tujuan Cepat** (ketuk slot "Tap untuk atur", ketik "Monumen")
- [ ] ★ Gulir dengan keyboard terbuka: baris terakhir bisa dilihat. **iOS berisiko:** dialog tanpa `KeyboardAvoidingView`, jadi bagian bawah mungkin tertutup keyboard.
- [ ] Ketukan pertama langsung memilih, bukan hanya menutup keyboard.

**Lapor Kepadatan** (Peta Kepadatan → Lapor → "Monumen"; jangan kirim laporan sebelum S1)
- [ ] ★ 8 hasil bisa digulir; ketukan pertama lanjut ke pilihan tingkat kepadatan.

**Peta Semua Halte** (cari "Pasar")
- [ ] Drag tidak memilih; daftar 20 baris bisa digulir; ketuk mengarahkan peta ke halte itu.

**Layar TOTO** (akun demo)
- [ ] Tepat dua tombol saran; yang panjang membungkus, tidak keluar layar.
- [ ] Catatan "Jawaban TOTO bisa keliru..." terlihat di atas kotak ketik, juga saat keyboard terbuka.
- [ ] Ketuk jam operasional: jawaban 05:00–22:00, tanpa tombol buka rute.
- [ ] "Halte terdekat dari saya di mana?" dengan GPS: kartu halte tetap muncul, tombolnya berfungsi.

**Tetap dari daftar sebelumnya**
- [ ] Tampilan teks native setelah `cssInterop` (Hari 3).
- [ ] Rentang "92–106 mnt" dan baris CO₂ di kartu hasil pada lebar layar HP.

## 6. Regresi

| Rangkaian | Hasil |
|---|---|
| `tsc --noEmit` backend & frontend | 0 galat |
| `/routes` S1, S2 sebelum/sesudah Monas, S3, L1, L2 | **Identik** baseline |
| Chip moda | 4/4 |
| Backend: akun-riwayat ratelimit/main/persist, demo-preflight, feedback | 10/48/3, 16, 11 |
| Backend: toto-grounding (baru), toto-privacy, toto-refund, air-quality, otp-down | 20, 16, 19, 11, 9 |
| App: co2-pipeline, route-badges, accessibility-pipeline, assistive-settings | 11, 19, 54, 34 |
| App: trip-pass, feedback-draft, error-mapping mock/backend-dead | 27+1, 2+5, 69/17 |
| App: gps-notice, about-partnership, scan-ui-text | 17, 7, 4 |
| Browser: route-card-layout, location-picker-scroll (baru), toto-screen (baru) | 34, 33, 22 |

**Preflight terakhir** (3 Nov 07.37, backend bersih): 15 PASS · 0 WARN · 0 FAIL. OTP2 hidup, 4 feed.
