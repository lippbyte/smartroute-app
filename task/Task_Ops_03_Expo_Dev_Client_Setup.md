# Task Ops-03: Setup Expo Dev Client untuk Iterasi Cepat di Native

**Assignee:** Lippable

## Tujuan

Bangun sekali "Dev Client" build (APK khusus yang menyertakan native module seperti MapLibre), supaya perubahan kode JS berikutnya bisa langsung di-reload ke HP dalam hitungan detik lewat Metro bundler — tanpa perlu full EAS build ~20 menit tiap kali ada perubahan.

## Konteks

Sepanjang proyek ini, perubahan kode app kebanyakan cuma sempat diverifikasi lewat web (Playwright) sebelum ada kesempatan dites native, karena full EAS build makan waktu 20 menit tiap kali. Ini yang menyebabkan bug native-spesifik (seperti `keyboardShouldPersistTaps` di App-09) baru ketahuan belakangan, bukan saat development. Dev Client menyelesaikan ini untuk semua perubahan JS-level ke depan (App-09 Bagian 2, App-11 jalur koridor, dst) — **build native cuma perlu diulang kalau ada native module BARU ditambahkan**, bukan untuk perubahan kode JS biasa.

## Lingkup

1. Install `expo-dev-client` sebagai dependency.
2. Tambah profile baru di `eas.json`, misal `"development"`, dengan `"developmentClient": true` dan `"distribution": "internal"` — reuse environment variable backend URL (localtunnel/ngrok) yang sama dari profile `"preview"` yang sudah ada.
3. Build sekali lewat EAS dengan profile development ini (`eas build --profile development --platform android`).
4. Install APK dev client ke HP.
5. Jalankan `npx expo start --dev-client` di laptop, connect dari dev client di HP (scan QR atau masukkan URL manual).
6. Verifikasi: ubah sesuatu kecil di kode JS (misal ganti teks tombol), simpan, pastikan perubahan muncul di HP dalam hitungan detik tanpa build ulang.

## Batasan eksplisit

- **Jangan hapus/ganti profile `"preview"`** yang sudah ada di `eas.json` — dev client ini profile tambahan, bukan pengganti. Build final untuk demo tetap perlu APK standalone (preview/production), karena dev client butuh laptop menyala terus untuk Metro bundler — tidak cocok untuk demo mandiri.
- Setelah dev client jalan, **Task App-09 Bagian 1 (fix `keyboardShouldPersistTaps`) wajib diverifikasi ulang** lewat dev client ini — bukan dianggap selesai berdasarkan penalaran/teori saja seperti laporan sebelumnya.

## Acceptance criteria

- Dev Client APK berhasil di-build dan terinstall di HP.
- Perubahan kode JS di laptop ter-refresh ke HP dalam hitungan detik (bukan menit) tanpa build ulang — diverifikasi dengan perubahan kecil yang sengaja dibuat untuk tes.
- Task App-09 Bagian 1 diverifikasi ulang lewat dev client ini, hasilnya dilaporkan eksplisit (berhasil/gagal) — bukan "kemungkinan besar benar" seperti sebelumnya.
