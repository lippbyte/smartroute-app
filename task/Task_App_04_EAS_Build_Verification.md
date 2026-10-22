# Task App-04: Verifikasi Native via EAS Build Cloud

**Assignee:** Lippable
**Prasyarat:** Task App-03 selesai (kode native `CrowdMapView.native.tsx` sudah ditulis, tapi belum terverifikasi jalan di device — diblokir karena tidak ada Android SDK lokal).

## Tujuan

Verifikasi implementasi native dari Task App-03 benar-benar jalan di device fisik, pakai **EAS Build cloud** — supaya tidak butuh Android SDK/emulator lokal sama sekali.

## Konteks

Laporan App-03 menyimpulkan blocker karena tidak ada Android SDK lokal (`ANDROID_HOME` kosong, tidak ada `adb`/`emulator`/AVD). Tapi analisis itu hanya mempertimbangkan build lokal (`expo run:android`) — **belum mencoba jalur EAS Build cloud**, yang justru dari awal dipilih tepat karena menghindari kebutuhan SDK lokal: kompilasi native terjadi di server Expo, hasilnya berupa APK yang tinggal diunduh & diinstall ke HP.

## Lingkup

- Cek `eas.json` di folder `smartroute` — pakai profile yang sudah ada (`development` atau `preview`), proyek ini sudah punya EAS project terdaftar dari awal.
- Jalankan `eas build --platform android --profile <profile_yang_ditemukan>`.
- Setelah build selesai, akan ada link/QR untuk unduh APK — user (Lippable) yang install manual ke HP fisik miliknya sendiri.
- Setelah terinstall, verifikasi ulang acceptance criteria App-03 yang sebelumnya tidak bisa diuji:
  - App terbuka tanpa crash.
  - Layar Peta Kepadatan menampilkan marker dengan warna dan lokasi yang benar.
  - Tap marker menampilkan info card yang benar (nama halte, level, waktu laporan).
- Kalau EAS build sendiri gagal (bukan karena SDK, tapi sebab lain — quota, config, dependency native yang salah link, dll): **laporkan detail error persisnya**, jangan langsung lompat ke opsi install SDK lokal tanpa didiskusikan dulu.

## Batasan eksplisit

- **Jangan install Android SDK/Android Studio apa pun di mesin ini** — itu tetap dihindari sesuai keputusan awal; EAS Build cloud adalah jalur utama untuk task ini.
- **Jangan sentuh isu Google Maps API key di `NavigateMap.native.tsx`** — itu temuan terpisah yang keputusannya belum diambil (migrasi ke MapLibre vs. daftar key), di luar scope task ini.
- Kalau build EAS gagal karena masalah konfigurasi proyek (bukan quota/jaringan), laporkan dulu sebelum mencoba perbaiki sendiri lebih dari ~30 menit troubleshooting.

## Acceptance criteria

- Build EAS selesai dan menghasilkan APK yang bisa diinstall.
- APK terinstall dan terbuka di HP fisik tanpa crash.
- Layar Peta Kepadatan native menampilkan marker dengan warna dan lokasi yang benar — diverifikasi visual langsung di HP.
- Tap marker menampilkan info card yang benar.
- Kalau ada kegagalan di titik mana pun dalam proses ini, laporan menyebutkan persis apa yang gagal dan pesan errornya — bukan sekadar "gagal."
