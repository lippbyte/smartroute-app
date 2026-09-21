# Task Ops-02: Setup ngrok Static Domain + Build APK Konsolidasi

**Assignee:** Lippable
**Prasyarat:** Task Backend-08, App-05, App-06, App-07, App-08 semua selesai — build ini menggabungkan semua perubahan sekaligus, bukan satu-satu.

## Tujuan

Hilangkan ketergantungan APK ke IP LAN yang berubah tiap pindah WiFi, dengan pakai ngrok tunnel + domain statis gratis. Sekalian jadi satu build EAS konsolidasi yang mengumpulkan semua perubahan sejak build terakhir (App-04).

## Lingkup

### 1. Setup ngrok
- Daftar/login akun ngrok (gratis).
- Reserve satu **static domain gratis** lewat dashboard ngrok (format `<nama>.ngrok-free.app`) — bukan domain acak yang berubah tiap restart.
- Jalankan tunnel: `ngrok http --domain=<nama>.ngrok-free.app 3000` (arahkan ke port backend).
- Verifikasi dari device/jaringan **lain** (bukan laptop yang sama): akses URL ngrok, pastikan `/health` merespons benar.

### 2. Update konfigurasi app
- Ganti `EXPO_PUBLIC_API_BASE_URL` dari IP LAN ke URL ngrok statis (`https://...`).
- Karena ngrok memberi HTTPS, cek apakah workaround `usesCleartextTraffic` (dari App-04) masih diperlukan — kalau tidak, boleh dihapus untuk konfigurasi yang lebih bersih (opsional, bukan wajib).

### 3. Build EAS konsolidasi
- Satu build baru (profile sama seperti sebelumnya) yang menggabungkan **semua** perubahan kode app sejak build terakhir: App-05 (GPS), App-06 (autocomplete), App-07 (UI submit laporan + fix `fitBounds`), App-08 (`departure_time`), plus konfigurasi ngrok baru.

### 4. Verifikasi lintas-jaringan
- Install APK baru ke HP.
- **Matikan WiFi HP, pakai data seluler** — ini pembuktian utama bahwa ketergantungan ke WiFi laptop sudah hilang. Coba search rute dan submit laporan kepadatan dari kondisi ini.

## Batasan eksplisit

- **Jangan nyalakan tunnel ngrok terus-menerus di luar sesi kerja/rehearsal/demo** — matikan setelah selesai. Backend tidak ada autentikasi, jadi selama tunnel aktif, siapa pun dengan URL-nya bisa mengakses.
- Jangan share URL ngrok ke luar tim atau di tempat publik manapun.
- Jangan hapus dukungan IP LAN dari kode — cukup ganti nilai env var default-nya, biar tetap fleksibel untuk development lokal biasa di kemudian hari.

## Acceptance criteria

- Tunnel ngrok dengan domain statis berhasil dibuat dan diverifikasi bisa diakses dari luar laptop.
- APK baru berhasil di-build dengan semua perubahan App-05 s/d App-08 + koneksi ke ngrok URL.
- Terverifikasi: app di HP bisa connect ke backend **tanpa** WiFi yang sama dengan laptop (dites pakai data seluler, bukan WiFi).
- README diupdate: langkah menyalakan ngrok tunnel sebelum sesi kerja/rehearsal, mirip checklist OTP2 dari Task Ops-01.
