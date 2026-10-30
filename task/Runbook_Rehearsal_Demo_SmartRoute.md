# Runbook Rehearsal Demo — SmartRoute AI

**Tujuan dokumen:** menggabungkan app (backend + frontend) dan Model 0 jadi satu alur presentasi yang koheren, dengan skenario konkret, urutan yang masuk akal, dan rencana cadangan kalau ada yang gagal live.

**Asumsi yang saya pakai** (koreksi kalau meleset — ini menentukan struktur dokumen):
- Presentasi live dengan video sebagai fallback (sesuai PRD), bukan video-only.
- Device presentasi: laptop yang menjalankan backend+OTP2, frontend dibuka di browser (`expo start --web`) dan ditampilkan ke layar/projector — bukan dari HP yang di-pass ke juri.

---

## 1. Skenario Demo (5 skenario, ~urutan presentasi)

### Skenario 1 — Pencarian rute dasar (mode Komuter)
**Rute:** Blok M → Kota
**Tunjukkan:** rentang waktu tempuh (bukan angka tunggal), tarif flat, jumlah transfer.
**Talking point:** "Ini bukan cuma kalkulator rute — kami jujur soal ketidakpastian waktu tempuh."
**Catatan teknis:** pakai `departure_time` yang di-pin ke jam presentasi (bukan biarkan default "sekarang") — supaya hasil rehearsal dan hasil demo beneran identik. Ini pelajaran langsung dari bug yang ditemukan di Backend-03b kemarin.
**⚠ Urutan wajib:** jalankan Skenario 1 **SEBELUM** Skenario 2. Lihat "Risiko urutan" di Skenario 2.
**⚠ Perlu ditinjau presenter (diperbarui 30 Okt 2026, baseline regresi `departure_time` 2026-09-21T07:30+07:00):** urutan hasil Blok M → Kota hari ini:
1. **#1 = bus Koridor 1** ("1"), Rp3.500, 92–106 mnt, tanpa transfer.
2. **#2 = M+1** (MRT lalu Koridor 1), Rp11.500, 75–87 mnt, 1 transfer.
3. #3 = M+Cikarang+Bogor (Rp10.000, 64–74 mnt, 2 transfer); #4 = M+Bogor (Rp11.000, 74–86 mnt, 1 transfer).

Talking point "tarif flat" kembali cocok dengan #1. Catatan lama (21 Sep) yang menyebut M+1 sebagai #1 sudah tidak berlaku. Presenter perlu memutuskan narasinya: rute #1 bukan yang tercepat (#3 lebih cepat, tetapi 2 transfer).

### Skenario 2 — Momen utama: laporan kepadatan live mengubah rekomendasi
**Rute:** Pasar Baru → Lebak Bulus *(menggantikan Kalideres → PGC — di rute itu semua kandidat melewati halte yang sama, jadi laporan kepadatan tidak pernah membalik urutan)*
**Alur:**
1. Tunjukkan hasil awal: rekomendasi #1 **2+1+M** (bus via Monas, lalu MRT).
2. **Live**, lapor "padat" di halte **Monumen Nasional** lewat UI. Pencarian halte menampilkan 6 entri "Monumen Nasional" — **boleh pilih yang mana saja**, sistem menggabungkan semua peron satu halte.
3. Cari ulang rute yang sama — rekomendasi #1 pindah ke **Bogor+Cikarang+M** (KRL lalu MRT), dan rute via Monas turun dengan label padat.
**Terverifikasi:** berbalik di 6/6 jam uji (07:30–17:30), ~2,5 detik per pencarian.
**Talking point:** ini bukti konkret sistem "belajar" dari kondisi lapangan secara real-time — bagian paling penting untuk ditunjukkan karena paling terlihat "pintar."
**Risiko:** ini depend ke jaringan + backend jalan mulus di depan juri. **Wajib direkam sebagai video cadangan.**
**⚠ Risiko urutan — JANGAN ulang Skenario 1 dalam 15 menit setelah Skenario 2.** Laporan "padat" di Monas bertahan 15 menit, dan **dua** rute teratas Skenario 1 melewati Monas lewat Koridor 1. Kalau Skenario 1 diulang dalam jendela itu (misalnya audiens minta diulang), hasilnya **berbeda** dari rehearsal. **Perlu ditinjau presenter (diukur 30 Okt 2026, jam terkunci sama):** bus Koridor 1 (#1) dan M+1 (#2) turun ke #3/#4 berlabel padat, dan #1 pindah ke **M+Cikarang+Bogor**. Kalau harus mengulang: **restart backend dulu** (lihat bagian 2a; laporan tersimpan di memori dan hilang saat restart), atau tunggu 15 menit.

### Skenario 3 — Mode Wisatawan
**Rute:** Grogol → Kampung Melayu
**Tunjukkan:** toggle mode, instruksi langkah-demi-langkah yang lebih detail dibanding mode Komuter.
**Talking point:** satu backend, dua pengalaman — untuk penduduk lokal dan pendatang.

### Skenario 4 — Asisten wayfinding LLM
**Pertanyaan live:** salah satu dari 5 yang sudah direhearsal di Task Backend-06 (mis. "dari Blok M ke Kota naik apa?").
**Talking point:** ini AI yang benar-benar dipanggil live, bukan respons yang di-hardcode.
**Risiko:** tergantung OpenRouter API — kalau gagal, punya 1 pertanyaan cadangan yang jawabannya sudah direkam sebagai fallback.

### Skenario 5 — Showcase Model 0 (Computer Vision)
**Tunjukkan:** video hasil overlay (2 kandidat terbaik + 1 video HP asli Jakarta).
**Talking point eksplisit, harus dikatakan jelas:** "Ini showcase kapabilitas pipeline deteksi & tracking di footage transit publik untuk validasi teknis — bukan rekaman halte Jakarta, karena kami belum punya akses kamera CCTV stasiun. Video ketiga ini contoh di kondisi asli kami sendiri."
**Ini diputar dari video yang sudah direkam, bukan dijalankan live** — sudah diputuskan sebelumnya, risiko rendah.

---

## 2. Checklist Setup Sebelum Presentasi

- [ ] Backend (`npm run dev`) dan OTP2 (`docker compose up`) jalan, dicek `/health` dulu.
- [ ] `departure_time` untuk tiap skenario sudah ditentukan dan dicatat (bukan andalkan waktu presentasi kebetulan cocok).
- [ ] OTP2 sudah dipanaskan dengan 3–5 pencarian dummy — pencarian pertama setelah OTP2 menyala bisa ~19 detik, sesudahnya <3 detik.
- [ ] Backend di-restart tepat sebelum presentasi, supaya tidak ada laporan kepadatan sisa rehearsal yang masih aktif (bertahan 15 menit) dan menggeser hasil Skenario 1.
- [ ] Urutan skenario dipegang: **1 sebelum 2**. Petugas teknis tahu cara restart backend kalau juri minta Skenario 1 diulang sesudah Skenario 2.
- [ ] Frontend dibuka di browser, di-test sekali penuh sebelum juri datang (bukan cuma dicek pagi harinya).
- [ ] OpenRouter API key aktif, kuota dicek cukup.
- [ ] 3 video Model 0 (2 stock terbaik + 1 video Jakarta) sudah di-load di device presentasi, bukan streaming dari cloud.
- [ ] Koneksi internet cadangan (hotspot HP) siap kalau WiFi venue bermasalah.

### 2a. Reset cepat hazard Skenario 1 (restart backend)

**Restart backend = cara tercepat mereset hazard Skenario 1.** Laporan kepadatan (crowd report) hanya disimpan di **memori** backend, jadi restart langsung menghapus semua laporan aktif, termasuk laporan Monas dari Skenario 2. Hasil Skenario 1 kembali sama dengan rehearsal, tanpa menunggu 15 menit.

- **Yang TIDAK ikut terhapus:** akun, riwayat perjalanan, dan rating (sejak Hari 1 tersimpan di file SQLite `backend/backend-skeleton/data/smartroute.db`). Pengguna yang sedang masuk di app tetap masuk.
- **Cara restart yang aman** (hanya proses backend di port 3000, bukan semua proses `node`, karena itu ikut mematikan Metro):
  ```powershell
  (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess | % { taskkill /PID $_ /T /F }
  cd backend/backend-skeleton; npm run dev
  ```
  Tunggu baris `Server listening on http://localhost:3000`, lalu cek `/health`. Tunnel ngrok tidak perlu di-restart.
- Klaster halte dimuat ulang beberapa detik setelah start. Kalau mau aman, jalankan satu pencarian dummy dulu sebelum mengulang Skenario 1 di depan audiens.

### 2b. Layar Masuk saat app dibuka (sejak Hari 1)

- App yang belum pernah dibuka di perangkat itu menampilkan layar **Masuk**. Untuk demo fitur inti, ketuk **"Lanjut sebagai tamu"**. Pilihan ini diingat, jadi tidak ditanya lagi di pembukaan berikutnya.
- **TOTO (Skenario 4) wajib masuk** sejak Hari 1: tamu hanya melihat ajakan "Masuk untuk memakai TOTO". Akun demo punya batas lebih tinggi (bawaan 100 pertanyaan/jam; pengguna biasa 30/jam; semua pengguna 300/hari). Kalau TOTO menolak karena batas di tengah rehearsal, naikkan **tanpa restart** dengan menulis `backend/backend-skeleton/data/toto-limits.json`, mis. `{ "daily_cap": 500, "demo_hourly_limit": 200 }`.
- Untuk demo riwayat/TOTO, masuk dengan **akun demo**. Buat sekali dengan `npm run seed:demo` di `backend/backend-skeleton`. Kredensialnya ada di `backend/backend-skeleton/data/demo-account.local.json` (tidak di-commit; jangan ditampilkan di layar/projector).

## 3. Rencana Cadangan (Fallback)

- **Video rekaman lengkap seluruh alur** (5 skenario di atas, direkam end-to-end sekali jalan mulus) — diputar kalau ada kegagalan teknis live. Ini eksplisit diminta PRD, belum ada sampai sekarang.
- Screenshot/GIF hasil tiap skenario sebagai cadangan kedua kalau video pun bermasalah.
- 1 anggota tim ditugaskan khusus pegang laptop/koneksi selama presentasi (bukan yang sedang presentasi juga yang pegang teknis).

## 4. Kemungkinan Pertanyaan Juri (siapkan jawaban singkat)

- "Data kepadatan ini beneran real-time, atau simulasi?" → jujur: dari laporan pengguna langsung (crowdsource), bukan sensor/kamera — itu justru bagian dari desain kami karena data GPS armada/tap-in real-time tidak tersedia publik.
- "Apa bedanya dari JAKI/JakLingko?" → sudah dijawab di proposal bagian 3.2, siapkan versi lisan singkat.
- "Model AI-nya di mana?" → dua tempat: asisten wayfinding (LLM, live) dan skor rekomendasi (heuristik, bukan ML — jujur soal ini, jangan overclaim).
- "Kenapa video CV bukan dari halte Jakarta?" → jawaban sudah disiapkan di skenario 5 di atas.

---

## 5. Yang Masih Perlu Diputuskan Sebelum Rehearsal Pertama

- **Berapa lama slot waktu presentasi?** Ini menentukan apakah 5 skenario di atas semua muat, atau perlu dipangkas jadi 3.
- **Siapa yang presentasi vs pegang teknis?** Perlu ditentukan sebelum rehearsal pertama, bukan diputuskan dadakan.
- **Kapan rehearsal pertama dijadwalkan?** — sisa waktu kompetisi menentukan berapa banyak putaran rehearsal yang realistis.
