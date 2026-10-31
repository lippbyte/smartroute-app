# Laporan Hari 4 — Stabilisasi, Preflight Demo, Runbook Investor

**Cabang:** `feat/hari4-stabilisasi` (turunan `feat/hari3-aksesibilitas-trippass` @ `9112dde`). **Tidak di-merge ke `main`, tidak ada tag.**
**Tanggal:** 31 Okt 2026. Tidak ada fitur baru, tidak ada rebuild/paket native, OTP2/GTFS/tarif tidak disentuh.

## 1. Ringkasan per task

| Task | Hasil | Commit |
|---|---|---|
| 0 Audit | Dilaporkan sebelumnya (status git, blast radius `cssInterop`, 17 `TODO:verifikasi`, jalur galat belum diuji, status kunci) | — |
| 1a | 502 mesin rute tanpa URL/detail internal di body; detail hanya di log server | `1d24555` |
| 1b | Pemetaan galat terpusat di `apiClient` (jaringan, waktu habis, non-JSON/halaman ngrok, 5xx) untuk layar lama dan baru; tombol **Coba Lagi** di Hasil Rute | `898e458` |
| 1c | Kuota TOTO dikembalikan hanya bila provider pasti tidak menagih (401, 5xx, jaringan putus sebelum terhubung, tanpa kunci); bukan untuk timeout; batas harian tetap menghitung semua | `e9cdbdc` |
| 1d | "Tampilan mudah dibaca" disembunyikan di web; native tidak berubah (menunggu uji HP) | `6e5c073` |
| 1e | Izin lokasi ditolak → satu kalimat di navigasi (mode peta & sederhana) | `e7ad835` |
| 1f | Saldo negatif ditolak ("Saldo tidak boleh negatif."); pemindai teks UI → 0 TODO/placeholder; Kemitraan disembunyikan selama kontak kosong; `IQAIR_URL` di `.env.example` | `949c7d6`, `bc253ab`, `a1b049a` |
| 2 Preflight | `npm run preflight` (tabel PASS/WARN/FAIL, cadangan DB, idempoten) + uji 16/16 | `268a490` |
| 3 Runbook | `task/Runbook_Demo_Investor.md`, angka dari pengukuran hari ini, dicek otomatis 15/15 | `e98fcde` |
| 4 Pembekuan | Regresi penuh lulus, README "Menyalakan demo", `smartroute/.env.example`, uji CO₂ tidak lagi mengotori akun demo, laporan ini | `633ece0`, `8c5f904`, laporan |

## 2. Tabel galat (Task 1): kondisi × hasil

Semua diuji **hidup** kecuali yang ditandai.

| Kondisi | Sebelum | Sesudah | Bukti uji |
|---|---|---|---|
| OTP2 mati → `/routes` dan 6 endpoint lain | 502 dengan URL OTP2 internal di `message` | 502 `otp2_unavailable`, "Layanan rute sedang tidak tersedia. Coba lagi sebentar lagi."; detail di log server | `test-otp-down` 9/9; app `test-error-mapping otp-down` 9/9 |
| Backend mati (port mati) | "Tidak bisa menghubungi backend di http://…" (URL tampil) | "Tidak bisa menghubungi server. Periksa koneksi internet Anda, lalu coba lagi." + Coba Lagi; URL hanya di console | `test-error-mapping backend-dead` 17/17 |
| Tunnel ngrok hidup, backend mati (502 HTML) | "Backend mengembalikan … bukan JSON" | Pesan jaringan generik | `tunnel-backend-dead` 17/17 (ngrok asli) |
| Agen ngrok mati (404 HTML ERR_NGROK_3200) | Pesan teknis | Pesan jaringan generik | `tunnel-agent-dead` 17/17 (ngrok asli) |
| Waktu habis | Pesan per layar | Pesan operasi ("Pencarian rute terlalu lama…"), tanpa spinner abadi | mock 69/69 |
| Pengguna lanjut mengetik (abort) | — | Tidak dipetakan menjadi galat | mock |
| `OPENROUTER_API_KEY` kedaluwarsa/hilang | 502 ramah, **tetapi kuota per jam ikut terpakai** | 502 ramah; kuota per jam dikembalikan (401/5xx/koneksi/tanpa kunci); timeout dan putus-setelah-kirim tetap terhitung | `test-toto-refund` 19/19 |
| `IQAIR_API_KEY` hilang/salah | Sudah aman (Hari 2) | Tetap: kartu udara & lencana udara tidak tampil, tanpa galat | `test-air-quality` 11/11; preflight WARN |
| Izin GPS ditolak (navigasi) | Diam, tanpa penjelasan | "Izin lokasi ditolak, jadi geser langkah dengan tombol di bawah." | `test-gps-notice` 17/17 |
| Pencarian lokasi tanpa hasil | `200 []` | Sama (daftar saran kosong, tanpa galat) | live `/stations/search`, `/stops/search` |
| Nama lokasi sangat panjang | `shortPlaceLabel` + `numberOfLines` | Tidak diubah | **Belum diuji di HP** (`TODO:verifikasi`) |
| Sesi kedaluwarsa (riwayat, rating, TOTO) | Sudah ditangani Hari 1 (arahkan ke Masuk) | Tidak diubah | `test-akun-riwayat` 48/48, `test-toto-privacy` G2 |
| Rating ganda / trip ganda | Sudah idempoten Hari 1 | Tidak diubah | `test-akun-riwayat` main |
| Saldo simulasi negatif | `"-5000"` diam-diam menjadi 5000 | Ditolak: "Saldo tidak boleh negatif." | `test-trip-pass` T10b–e |
| Saldo simulasi nol | Diterima | Diterima (T6, T10c) | `test-trip-pass` |
| Teks TODO/placeholder di UI | "Kontak: segera tersedia" | 0 temuan (115 berkas, 2.894 string) | `scan-ui-text` + uji-diri |
| Rotasi layar | Native dikunci potret (`app.json`) | Tidak diubah | Web layar sempit **belum diuji** (`TODO:verifikasi`) |
| "Tampilan mudah dibaca" di web | Rusak (`$$css`) | Disembunyikan di web | `test-assistive-settings` 34/34 |

**Temuan tambahan (Task 4):** uji Hari 2 `test-co2-pipeline` memakai akun demo, sehingga Riwayat akun demo kini berisi **5 perjalanan uji "Blok M (uji CO₂) → Kota"**. Ujinya sudah diperbaiki (`8c5f904`). Data yang ada **tidak dihapus**, karena itu keputusan Khalifa (lihat bagian 4).

## 3. Regresi akhir

| Rangkaian | Hasil |
|---|---|
| `tsc --noEmit` backend & frontend | 0 galat |
| `/routes` S1, S2 (PB) sebelum/sesudah Monas, S3, L1, L2 vs baseline Hari 3 | **Identik** (urutan, skor, tarif, menit, kandidat) |
| Chip moda Bus/KRL/MRT/LRT | 4/4 |
| Backend: akun-riwayat ratelimit [tunnel] / main / persist (sesudah restart) | 10 / 48 / 3 |
| Backend: toto-privacy, toto-refund, air-quality, feedback [tunnel], otp-down, demo-preflight | 16, 19, 11, 11, 9, 16 |
| App: co2-pipeline, route-badges, accessibility-pipeline, assistive-settings | 11, 19, 54, 34 |
| App: trip-pass main/reopen, feedback-draft offline/online | 27/1, 2/5 |
| App: error-mapping mock / backend-dead / otp-down / tunnel ×2 | 69 / 17 / 9 / 17 / 17 |
| App: gps-notice, about-partnership, scan-ui-text | 17, 7, 4 |
| `test-toto.mjs` (5 pertanyaan ke OpenRouter asli) | **Tidak dijalankan**: ditunda sampai kunci baru (keputusan Hari 1) |
| Rahasia ter-commit | Tidak ada (`.env`/DB/kredensial demo di-gitignore; nilai kunci & password demo tidak ada di pohon maupun riwayat git) |

**Preflight terakhir** (sesudah restart akhir, 20.20 WIB): 13 PASS · 1 WARN · 1 FAIL.
- FAIL: TOTO, kunci OpenRouter **kedaluwarsa**.
- WARN: kualitas udara, kunci IQAir **tidak ada**.
- S1 #1 `1` 456 ms, S2 #1 `2+1+M` 1.648 ms, S3 #1 `3+8+5C` 2.826 ms; laporan kepadatan 0.

**Status OTP2 akhir:** container `otp2-transjakarta` *Up 15 hours* (tidak di-restart), 4 feed, menjawab 16 ms. Backend di-restart di akhir (port 3000), dalam keadaan bersih.

## 4. Keputusan / `TODO:verifikasi` yang masih terbuka

| Butir | Dampak ke demo | Siapa |
|---|---|---|
| Kunci OpenRouter baru → jalankan ulang 5 pertanyaan TOTO | TOTO tidak bisa didemokan | Khalifa |
| Kunci IQAir | Tanpa kartu udara & lencana udara (aman) | Khalifa |
| **Hapus 5 perjalanan uji "Blok M (uji CO₂)" dari akun demo** | Riwayat terlihat seperti data uji | Khalifa (cadangan DB ada di `data/backups/`) |
| Uji HP: dampak `cssInterop` pada `Text` | Tampilan teks native | Tim HP → Khalifa. Cara batal: (1) `git checkout df53b8d~1 -- smartroute/src/components/Text.tsx`; (2) di `smartroute/src/utils/assistiveSettings.ts`, `unavailableAssistiveKeys` mengembalikan `["easyRead"]` untuk semua platform (bukan hanya web), sehingga pilihan itu hilang dari kartu; (3) `tsc` + `test-assistive-settings` (S20–S27 disesuaikan); satu commit kecil |
| Nama lokasi panjang & layar sempit (web) di layar Hari 1–3 | Teks terpotong/bertumpuk | Tim HP/web |
| Kartu hasil hanya menampilkan menit batas bawah (rentang di Trip Pass/Ringkasan/Riwayat) | Narasi "rentang ETA" harus ditunjuk di tempat yang benar | Khalifa (ubah atau biarkan) |
| Durasi nyata tiap segmen runbook, video cadangan S1/S2/TOTO | Waktu presentasi | Tim (gladi) |
| Kontak kemitraan, tagline final | Bagian Kemitraan tersembunyi | Khalifa |
| Model bisnis untuk jawaban investor | Pertanyaan sulit | Tim/Khalifa |
| Faktor emisi (MRT, LRT, KRL, bus, mobil, motor), rentang jalan kaki "sedang", nama kota IQAir | Angka CO₂ berlabel estimasi | Tim data |
| Token di AsyncStorage tidak terenkripsi; trust proxy hanya untuk ngrok (localtunnel belum dicek); batas per IP sebelum produksi | Bukan untuk demo; sebelum produksi | Tim backend |
| Kata-kata label preferensi, petunjuk umum Trip Pass | Teks UI | Tim |

## 5. Status git

- Cabang `feat/hari4-stabilisasi`: 12 commit Hari 4 + laporan ini, di atas `9112dde`. **Di-push ke cabang fitur** (bukan `main`).
- Tidak ter-commit (sengaja, bukan bagian Hari 4): `smartroute-dashboard/package-lock.json` (perubahan lama), dokumen `task/TASK_ClaudeCode_Hari1–4_*.md` (berkas brief).
- `.env` lokal backend mendapat satu baris non-rahasia: `DEMO_TUNNEL_URL` (dibaca preflight).
- **Usul tag:** `demo-candidate-1` pada commit laporan ini (HEAD cabang). **Belum dibuat**, menunggu perintah Khalifa setelah uji HP.

## 6. Risiko tersisa untuk hari-H

1. **TOTO** mati sampai kunci diganti; kalau kunci baru datang mepet, Q1–Q5 belum diukur ulang (Q5 tetap berisiko).
2. **Riwayat akun demo** berisi data uji sampai dibersihkan.
3. **Urutan S1 → S2**: laporan Monas bertahan 15 menit dan menggeser S1; mengulang S1 butuh restart backend (preflight mendeteksinya sebagai WARN).
4. **Hasil S2 sesudah Monas bergantung jam**: rute #1 pengganti berbeda (Bogor+Cikarang+M pada 07:30 Senin, Bogor+M pada Sabtu malam); kalimat presenter sudah dibuat generik.
5. **Tampilan native** belum diuji setelah `cssInterop` (Hari 3) dan perubahan Hari 4.
6. **Rating permanen**: satu per perjalanan; gladi bisa menghabiskan perjalanan yang belum dinilai.
7. Laptop restart mematikan semuanya; urutan menyalakan ada di README "Menyalakan demo" dan diverifikasi oleh preflight.
