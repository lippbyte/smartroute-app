# Task App-03: Versi Native (Mobile) Peta Kepadatan

**Assignee:** Lippable
**Prasyarat:** Task App-02 selesai (sumber tile sudah bersih). Task App-01 selesai (versi web sudah ada dan diverifikasi).

## Tujuan

Bangun versi native (Android/iOS) dari layar Peta Kepadatan, supaya prototype bisa didemokan sebagai app mobile beneran — bukan cuma versi web. Ini keputusan sengaja untuk menerima kerja tambahan demi prototype yang bentuknya mobile.

## Konteks penting

Ini kemungkinan besar jadi **percobaan build native pertama** di seluruh proyek ini — belum pernah ada build native yang benar-benar dijalankan sejak awal. Artinya task ini punya dua risiko yang bertumpuk: (1) kode fitur peta itu sendiri, dan (2) kemungkinan masalah native yang selama ini dorman (izin lokasi yang dideklarasikan di `app.json` tapi belum pernah dites jalan beneran, dependency `react-native-maps` yang belum dibersihkan, konfigurasi EAS yang belum pernah dipakai). **Alokasikan waktu ekstra untuk kemungkinan #2, jangan cuma hitung waktu ngoding fiturnya.**

App sudah punya pola arsitektur yang tepat untuk ini: `NavigateMap.native.tsx` sudah ada, pakai `@maplibre/maplibre-react-native` dengan style CartoCDN dark-matter — **cek dulu apakah style ini juga kena masalah API-key-required seperti versi web**, jangan asumsikan aman.

## Lingkup

- Refactor `crowd-map.tsx`: pisahkan bagian rendering peta ke komponen terpisah (`CrowdMapView`), dengan pola split platform yang sama seperti `NavigateMap` (`CrowdMapView.web.tsx` = logic iframe yang sudah ada dari App-01/App-02, `CrowdMapView.native.tsx` = implementasi baru). Layar `crowd-map.tsx` sendiri jadi shared, tinggal import `CrowdMapView` dan Metro otomatis pilih versi yang sesuai platform.
- `CrowdMapView.native.tsx`: pakai `@maplibre/maplibre-react-native` (sudah ada di dependency, dipakai `NavigateMap.native.tsx`) — render marker berwarna sesuai level (reuse skema warna dari versi web), tap marker munculkan info (nama halte, level, waktu laporan terakhir) via callout/popup MapLibre RN.
- Hapus pesan fallback "baru tersedia di versi web" dari App-01 — sekarang native punya implementasi asli, bukan fallback lagi.
- **Jalankan build native sungguhan** (`expo run:android` minimal — cukup satu platform dulu untuk smoke test, tidak perlu build EAS penuh) dan konfirmasi app jalan tanpa crash di emulator/device.
- Selama proses ini, verifikasi juga apakah izin lokasi (yang sudah dideklarasikan di `app.json`) benar-benar diminta dengan wajar saat pertama kali dibuka — ini kesempatan pertama izin ini benar-benar diuji.

## Batasan eksplisit

- Jangan kerjakan build EAS penuh (submit ke App Store/Play Store) — cukup development build lokal untuk smoke test.
- Jangan hapus dependency `react-native-maps` di task ini kalau ternyata tidak ada waktu — itu cleanup terpisah, boleh dicatat sebagai technical debt kalau memang mengganggu, tapi jangan jadi blocker task ini.
- Kalau proses build native ternyata gagal karena masalah environment yang di luar scope fitur ini (mis. Android SDK belum terkonfigurasi, sertifikat, dll) — laporkan segera sebagai blocker, jangan coba selesaikan sendiri kalau di luar 1-2 jam troubleshooting wajar.

## Acceptance criteria

- App berhasil di-build dan jalan di Android emulator/device (minimal satu platform) tanpa crash.
- Layar Peta Kepadatan native menampilkan marker dengan warna dan lokasi yang benar (diverifikasi visual langsung di device/emulator, sama seperti verifikasi versi web).
- Tap marker menampilkan info yang benar.
- Izin lokasi diminta dengan wajar (tidak crash, tidak diabaikan diam-diam).
- Versi web (App-01/App-02) tetap berfungsi seperti sebelumnya — refactor split platform tidak boleh merusak yang sudah jalan.
