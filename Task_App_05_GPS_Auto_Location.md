# Task App-05: Auto-isi Lokasi "Dari" via GPS

**Assignee:** Lippable
**Prasyarat:** Tidak ada — `expo-location` sudah jadi dependency dan sudah dipakai di `navigate.tsx`, tinggal reuse pola yang sama.

## Tujuan

Saat user buka layar pencarian rute, otomatis isi field "Dari" dengan lokasi GPS user saat ini (kalau izin diberikan) — mirip UX Gojek/Grab/Google Maps. User tetap bisa edit manual kapan saja.

## Konteks

Ini versi sederhana (sekali baca posisi saat layar dibuka) — **bukan** live-tracking titik bergerak di peta. Itu scope terpisah (rencana Task App-06), sengaja dipisah karena beban kerjanya beda jauh (continuous location watching vs sekali baca).

## Lingkup

- Minta izin lokasi (`expo-location`) saat layar pencarian rute dibuka.
- Kalau izin diberikan: ambil koordinat GPS saat ini, reverse-geocode jadi nama lokasi (reuse `geocode.ts`/Nominatim yang sudah ada) — kalau reverse geocode gagal/lambat, tampilkan fallback "Lokasi Anda saat ini" dengan koordinat, bukan dibiarkan kosong.
- Isi otomatis field "Dari" dengan hasil itu.
- Kalau izin ditolak: field "Dari" tetap kosong seperti sekarang, tidak ada error/crash, user tinggal ketik manual — jangan paksa izin dengan dialog berulang.

## Batasan eksplisit

- **Jangan implementasikan live-tracking/titik bergerak** di task ini — itu scope terpisah (App-06), beda jauh cara kerjanya (perlu `watchPositionAsync` berkelanjutan, bukan `getCurrentPositionAsync` sekali panggil).
- Jangan tambah dependency geocoding baru — reuse yang sudah ada.
- Jangan buat izin lokasi jadi wajib — app harus tetap sepenuhnya bisa dipakai dengan input manual kalau user menolak izin.

## Acceptance criteria

- Buka layar pencarian rute dengan izin lokasi diberikan → field "Dari" otomatis terisi tanpa perlu ketik manual.
- Izin lokasi ditolak → app tetap berfungsi normal, tidak crash, tidak ada dialog error yang mengganggu berulang.
- Field yang sudah terisi otomatis tetap bisa diedit manual oleh user.
