# Task Security-01: Audit & Mitigasi Kebocoran API Key

**Assignee:** Lippable
**Prioritas: SEGERA — kerjakan sebelum lanjut ke task manapun lainnya (termasuk App-03).**

## Tujuan

Pastikan `OPENROUTER_API_KEY` (dan credential lain yang mungkin ikut ter-expose) tidak pernah masuk ke git history atau ter-push ke remote repo manapun. Kalau ternyata pernah, rotate segera.

## Konteks

Ditemukan `.env` di `backend-skeleton` menyimpan `OPENROUTER_API_KEY` dengan nilai asli (bukan placeholder). Belum diketahui apakah file ini pernah ter-commit ke git history — ini yang harus dipastikan sekarang, bukan diasumsikan aman.

## Lingkup

### 1. Audit — lakukan di SETIAP repo/folder proyek (`backend-skeleton`, `otp2-setup`, `smartroute`, `smartroute-dashboard`, `task-01-model0-mini`, dan lainnya kalau ada)

- Cek apakah `.env` (atau file lain yang namanya mengandung "key"/"secret"/"token"/"credential") pernah ter-commit di git history manapun, **termasuk branch yang sudah dihapus**:
  ```
  git log --all --full-history -- "*.env" "**/.env"
  ```
- Cek apakah repo itu pernah di-push ke remote (`git remote -v`, bandingkan riwayat lokal vs remote) — dan kalau iya, **remote itu public atau private** (cek visibility di GitHub/platform yang dipakai).
- Kalau ketemu file yang mengandung credential di history: buka isinya di commit lama tersebut, catat **persis credential apa saja** yang mungkin ter-expose (jangan asumsi cuma OpenRouter — cek juga Google Places API key, database credentials, dll kalau pernah disimpan di situ).

### 2. Kalau ditemukan bukti kebocoran (ter-commit DAN pernah di-push ke remote manapun, public maupun private)

- **Rotate semua credential yang teridentifikasi** — generate key baru di dashboard masing-masing provider (OpenRouter, Google Cloud kalau ada, dll).
- Update `.env` lokal dengan key baru.
- **Verifikasi key lama sudah tidak berfungsi** — coba panggil API dengan key lama, harus gagal/ditolak.
- **Verifikasi app masih berfungsi normal dengan key baru** — test minimal end-to-end (mis. panggil `/assistant/ask` sekali, konfirmasi jawaban keluar).

### 3. Kalau TIDAK ditemukan bukti kebocoran (tidak pernah ter-commit, atau ter-commit tapi cuma lokal tanpa pernah push ke mana pun)

- Rotasi tetap disarankan sebagai langkah pencegahan murah (opsional, bukan wajib).
- **Wajib**: pastikan `.gitignore` di semua repo benar-benar mencegah `.env` ter-commit ke depan — cek langsung, jangan asumsi.

## Batasan eksplisit

- Jangan lakukan penghapusan riwayat git (`git filter-branch`, BFG, dll) kecuali benar-benar dipahami risikonya — mengubah history bisa merusak kerja tim lain kalau branch itu sudah pernah di-pull orang lain. Fokus ke **rotasi key**, bukan "membersihkan" history — begitu key dirotasi, key lama yang ada di history otomatis tidak berbahaya lagi karena sudah invalid.
- Jangan tulis key baru di tempat yang sama-sama berisiko (laporan, commit message, chat) — key baru cuma boleh ada di `.env` yang sudah dipastikan ter-gitignore.

## Acceptance criteria

- Laporan jelas per repo: ada/tidaknya `.env` di history, pernah di-push atau tidak, ke remote public/private/tidak pernah push sama sekali, dan credential apa saja yang teridentifikasi kalau ada.
- Kalau ditemukan kebocoran: bukti konkret rotasi selesai (key lama ditolak, key baru berhasil dipanggil).
- `.gitignore` di semua repo dikonfirmasi benar mencegah `.env` ke depan.
