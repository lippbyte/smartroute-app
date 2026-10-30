# Laporan Akhir Hari 1 — Login, Onboarding, Riwayat & Rating

**Tanggal:** 30 Okt 2026
**Branch:** `feat/hari1-akun-riwayat` (sudah di-push; **belum** di-merge ke `main`)
**Dokumen tugas:** [TASK_ClaudeCode_Hari1_Auth_Onboarding_Riwayat.md](TASK_ClaudeCode_Hari1_Auth_Onboarding_Riwayat.md)

Ringkasnya: akun, onboarding, riwayat, dan rating sudah jalan, dan hasil rute
tidak berubah sedikit pun. Satu bagian tertunda: uji jawaban TOTO dengan
model asli, karena API key OpenRouter kedaluwarsa. Uji layar di HP dikerjakan
terpisah oleh tim.

---

## 1. Status per Task

| Task | Status | Commit | Catatan |
|---|---|---|---|
| 0 — Audit | Selesai | — (hanya baca) | Tiga konflik dokumen-vs-kode dilaporkan dan diputuskan (1b, 2a, 3) |
| 1 — Backend akun, riwayat, rating | Selesai | `40a5e4a` | SQLite bawaan Node, scrypt, token acak 32 byte (disimpan SHA-256) |
| 2 — Login + mode tamu | Selesai | `30cdb54` | Batas login direvisi: hanya kegagalan, kunci IP+email, terverifikasi lewat tunnel |
| — Runbook S1 | Selesai | `631b9d9` | Urutan S1 dan efek Monas diukur ulang, ditandai "perlu ditinjau presenter" |
| 3 — Onboarding preferensi | Selesai | `96131bf` | Sesuai 2a: Cepat/Murah/Tenang, chip default tetap "Semua" |
| 4 — TOTO setelah login | **Sebagian** | `c00a888` | Poin 1–4 selesai. **Poin 5 ditunda** (key OpenRouter kedaluwarsa) |
| 5 — Ringkasan Perjalanan + Riwayat | Selesai | `4509703` | Digabung dengan Task 6 karena saling bergantung |
| 6 — Penilaian | Selesai | `4509703` | Draf bertahan saat jaringan gagal |
| 7 — Regresi & laporan | Selesai | commit laporan ini | Lihat bagian 2 |

---

## 2. Hasil regresi (sebelum vs sesudah Hari 1)

Semua pencarian memakai jam terkunci `2026-09-21T07:30+07:00`
(`scripts/regression-routes.mjs`). Baseline diambil sebelum perubahan apa pun,
dan sesudahnya diukur ulang di akhir Hari 1. Kedua pengukuran dilakukan dengan
OTP2 yang sudah dipanaskan.

| Skenario | Kandidat | #1 sebelum | #1 sesudah | Urutan + tarif + menit | Latensi sebelum → sesudah |
|---|---|---|---|---|---|
| S1 Blok M → Kota | 4 → 4 | `1` Rp3.500, 92–106 mnt | sama | **Identik** | 315 → 286 ms |
| S3 Grogol → Kp. Melayu | 4 → 4 | `3+8+5C` Rp3.500, 93–107 mnt | sama | **Identik** | 1.840 → 1.603 ms |
| S2 Pasar Baru → Lebak Bulus | 4 → 4 | `2+1+M` Rp17.500, 76–88 mnt | sama | **Identik** | 989 → 987 ms |
| S2 setelah lapor Monas | 4 → 4 | `Bogor+Cikarang+M` Rp17.000, 73–84 mnt | sama | **Identik, tetap berbalik** | 885 → 983 ms |
| L1 LRT Jati Mulya → Dukuh Atas | 3 → 3 | `Cikarang` | sama | Identik | 419 → 233 ms |
| L2 LRT Harjamukti → Kuningan | 3 → 3 | `Cibubur Line` | sama | Identik | 1.187 → 856 ms |

- **Kode rute tidak disentuh.** `git diff main` kosong untuk `routes.ts`, `routing.ts`,
  `recommendationScore.ts`, `crowdDensity.ts`, layar hasil rute, dan `legModes.ts`.
- **Chip moda:** Bus / KRL / MRT / LRT masing-masing mengembalikan rute yang hanya
  memakai moda itu (4/4). Kode chip kriteria tidak berubah, dan chip default tetap
  "Semua". Keterbacaan teks chip aktif belum dicek visual; kodenya tidak diubah.
- **`npx tsc`:** backend 0 galat, frontend 0 galat (baseline juga 0). Tidak ada galat baru.
- **Uji endpoint dijalankan ulang di akhir:**

| Skrip | Hasil |
|---|---|
| `test-akun-riwayat.mjs ratelimit` (termasuk lewat tunnel ngrok) | 10/10 |
| `test-akun-riwayat.mjs main` (Task 1, 3, 5) | 45/45 |
| `test-akun-riwayat.mjs persist` (setelah restart backend sungguhan) | 3/3 |
| `test-toto-privacy.mjs` (payload ke provider, tamu, batas, timeout) | 16/16 |
| Tamu ke `/assistant/ask` | 401 |

Hal penting yang terbukti:
- **Hasil `/routes` sama persis** dengan baseline: tidak perlu token, urutan,
  tarif, dan menit identik.
- **Payload ke provider LLM bersih.** Untuk akun yang punya 5 kebutuhan
  aksesibilitas plus riwayat, payloadnya tidak memuat satu pun dari 17 pola
  sensitif (email, ID, token, riwayat, aksesibilitas). Isinya hanya nama
  panggilan (sudah dibersihkan) dan prioritas, dan keduanya ada di pesan data
  terpisah, bukan di instruksi sistem.
- **Penghapusan aksesibilitas benar-benar tuntas.** Setelah dihapus, kolomnya
  di file database bernilai `NULL`.
- **"Aktual" tidak bisa dipalsukan.** Server menolak `duration_basis: aktual`
  yang tidak disertai durasi aktual.

---

## 3. `TODO:verifikasi` dan keputusan yang butuh Khalifa

**Keputusan yang dibutuhkan:**
1. **Pasang API key OpenRouter baru** dan cek saldonya. Key lama kedaluwarsa,
   sehingga TOTO saat ini selalu menjawab "Layanan asisten sedang tidak tersedia".
   Isi key langsung di `backend/backend-skeleton/.env`, lalu restart backend dan
   jalankan `node scripts/test-toto.mjs http://localhost:3000 hasil.json --demo`
   untuk menuntaskan Task 4 poin 5.
2. **Narasi S1 di runbook.** Rute #1 S1 adalah bus Koridor 1. Rute ini bukan
   yang tercepat: #3 lebih cepat 28 menit, tetapi butuh 2 transfer. Bagiannya
   ditandai "perlu ditinjau presenter".
3. **Kata-kata final teks persetujuan aksesibilitas.** Isi klaimnya sudah
   terverifikasi uji: data tidak dikirim ke TOTO dan bisa dihapus. Yang tersisa
   hanya kata-katanya. Teksnya ada di `smartroute/src/constants/preferenceLabels.ts`.

**`TODO:verifikasi` di kode:**

| Lokasi | Isi |
|---|---|
| `smartroute/src/services/tokenStorage.ts` | Token disimpan di AsyncStorage, **tidak terenkripsi** (keputusan 1b). Pindah ke `expo-secure-store` saat Dev Client di-build ulang |
| `backend/.../routes/auth.ts` | Pendaftaran memberi tahu bila email sudah dipakai (409). Menutupnya butuh verifikasi email |
| `backend/.../routes/auth.ts` | Batas login berkunci IP+email: menebak satu password ke banyak email dari satu IP tidak dibatasi |
| `backend/.../app.ts` | `trust proxy` terverifikasi untuk ngrok; localtunnel belum diuji |
| `backend/.../lib/rateLimit.ts` | Penghitung login/daftar ada di memori (cukup untuk satu instance backend) |
| `backend/.../lib/validation.ts` | Batas jalan kaki & moda yang dihindari hanya disimpan; cara menerapkannya tanpa mengubah scoring belum diputuskan |
| `smartroute/src/constants/preferenceLabels.ts` | Kata-kata final teks persetujuan (lihat keputusan 3) |

---

## 4. File yang diubah di luar rencana dokumen

Semua sudah disetujui atau perlu untuk fitur Hari 1. Tidak ada yang menyentuh
OTP2, GTFS, feed, tarif, scoring, atau crowd report.

| File | Perubahan | Alasan |
|---|---|---|
| `backend/.../src/app.ts` | `trust proxy loopback`, header CORS `Authorization`, handler galat JSON | Batas login per IP lewat tunnel; app web harus bisa mengirim token; body rusak sebelumnya dibalas halaman HTML berisi stack trace |
| `backend/.../src/lib/openRouterClient.ts` | `OPENROUTER_URL` opsional | Khusus uji payload ke provider tiruan. Jangan diisi saat demo |
| `smartroute/src/type.ts`, `routeService.ts` | Field opsional `travel_time_range` | Disetujui: prediksi tampil sebagai rentang |
| `smartroute/src/app/navigate.tsx` | Mencatat waktu mulai; "Aktual" hanya via trigger 75 m | Disetujui |
| `smartroute/src/components/navigate/ArrivalCelebration.tsx` | **Dihapus**, diganti `TripSummary.tsx` | Task 5: layar "Selamat" diganti Ringkasan |
| `task/Runbook_Rehearsal_Demo_SmartRoute.md` | Bagian 2a/2b + S1 diperbarui | Diminta |
| `backend/.../.env` (tidak di-git) | Blok `TOTO_*` ditambahkan di akhir | Diminta; isi lain tidak disentuh |

---

## 5. Status git

- **Ter-commit dan ter-push** di `feat/hari1-akun-riwayat`: `40a5e4a`, `30cdb54`,
  `631b9d9`, `96131bf`, `c00a888`, `4509703`, serta commit laporan ini.
  `main` tidak disentuh.
- **Masih tertinggal di working tree, sengaja tidak di-commit:**
  - `smartroute-dashboard/package-lock.json`: sudah berubah sebelum Hari 1 dimulai, di luar cakupan.
  - `task/TASK_ClaudeCode_Hari1_Auth_Onboarding_Riwayat.md`: dokumen tugas itu sendiri; silakan diputuskan mau di-commit atau tidak.
- **Tidak pernah masuk git** (di-`.gitignore`): `backend/.../data/`, berisi
  database akun, kredensial akun demo, dan file uji.

---

## 6. Risiko untuk Hari 2

1. **TOTO Q5 lambat sebelum LLM dipanggil (10–15 detik).** Pertanyaan yang
   membawa asal-tujuan ("Berapa lama perjalanannya dan apakah ramai?") menghitung
   rute dulu dengan waktu "sekarang". Hari ini terukur 15,4 detik dan 10,7 detik,
   *sebelum* panggilan LLM (yang gagal karena key). Kalau ditambah waktu jawab
   model, totalnya bisa mendekati batas 25 detik di app. **Belum diubah apa pun**:
   ukur ulang dulu dengan key baru. Dua opsi mitigasi:
   - **(a) Cache hasil rute untuk konteks TOTO.** Pakai ulang hasil `/routes` untuk
     asal-tujuan yang sama (koordinat dibulatkan + jendela waktu berangkat yang
     sama), terutama rute yang baru saja dicari pengguna di layar hasil. TOTO
     tidak perlu menghitung ulang.
   - **(b) Indikator "sedang mencari rute…" di gelembung jawaban** selama tahap
     pencarian rute. Latensinya tidak berkurang, tetapi pengguna tahu app tidak macet.
2. **TOTO mati untuk demo** sampai key baru dipasang.
3. **Layar belum diuji di HP oleh saya**, termasuk keyboard native, alur daftar →
   tutup app → buka lagi, dan navigasi S1 sampai trigger 75 m. Uji ini dikerjakan
   tim. Yang sudah terverifikasi: `tsc`, render SSR web tanpa galat, dan semua
   kontrak backend.
4. **Token belum terenkripsi** (AsyncStorage). Perlu build ulang Dev Client
   sebelum dipakai di luar demo.
5. **Database akun hanya ada di laptop.** File `data/smartroute.db` tidak di-git;
   kalau laptop rusak, akun dan riwayat hilang. Sarankan salin file itu (beserta
   `-wal`/`-shm`) secara berkala.
6. **Pekerjaan Hari 2 yang sudah disiapkan:**
   - Prioritas "Sehat": tambahkan ke `PRIORITIES` di backend (`validation.ts`) dan
     di app (`authService.ts` + `preferenceLabels.ts`).
   - CO₂: kolom `co2_estimate_g` sudah ada, dan saat ini semua bernilai `null`
     ("—" di Riwayat).
7. **Generator tipe rute Expo** sempat tidak mengenali folder baru saat dua Metro
   (8081 + 8097) berjalan bersamaan. Kalau `tsc` mengeluh soal rute baru, restart
   Metro web.
8. **Sapaan Beranda "Hai, Selamat Pagi!"** selalu "Pagi" berapa pun jamnya. Ini
   di luar cakupan Hari 1 dan tidak diubah.
