# Task Integration-02: Re-verifikasi dengan Backend Lengkap

**Assignee:** Lippable
**Prasyarat:** Task Backend-06 selesai (`crowd_level`, `reliability`, `recommendation_score` semua aktif dan rute ter-sort).

## Tujuan

Task Integration-01 dites **sebelum** Backend-04/05/06 selesai — saat itu `crowd_level` dan `reliability` selalu `undefined`, jadi yang teruji cuma jalur fallback ("Data belum tersedia"). Task ini memastikan UI benar-benar menampilkan data yang sekarang sudah lengkap dari backend, bukan masih diam-diam berasumsi field itu kosong.

## Konteks

`adaptToLegacyShape()` (dibuat di Integration-01) ditulis saat `recommendation_score` memang belum ada di backend sama sekali. Sekarang field itu ada dan dipakai buat sorting. Kalau adapter tidak diupdate, kemungkinan besar field ini masih di-drop diam-diam di proses adaptasi — bukan error yang keliatan, tapi silent bug.

## Lingkup

- Cek dan update `adaptToLegacyShape()`: pastikan `crowd_level`, `reliability`, dan `recommendation_score` dari response backend benar-benar di-map ke field frontend yang sesuai — bukan lagi selalu diperlakukan sebagai kosong.
- Verifikasi urutan rute yang tampil di UI mengikuti urutan `recommendation_score` descending dari backend — jangan di-sort ulang berbeda atau diacak di sisi frontend.
- Verifikasi tampilan `crowd_level`/`reliability` di UI sekarang menunjukkan data asli (label/ikon sesuai level low/moderate/high) untuk rute yang datanya ada.
- **Test-case kunci**: submit satu laporan kepadatan (`POST /crowd-reports`) untuk halte di salah satu rute AC, lalu search rute itu di UI — verifikasi tampilan `crowd_level` dan urutan rute berubah sesuai (mirip cara Backend-06 diverifikasi: post laporan → skor turun → re-sort, tapi sekarang dicek dari sisi tampilan, bukan cuma response API mentah).
- **Regresi check**: pastikan fallback graceful ("Data belum tersedia") tetap muncul untuk rute yang halte-haltenya belum ada laporan sama sekali — jangan sampai perbaikan ini malah bikin field terisi data palsu kalau memang belum ada data asli.

## Batasan eksplisit

- Jangan kerjakan perbaikan tampilan `travel_time_minutes` jadi rentang di task ini — itu tetap technical debt terpisah untuk pemilik frontend, sudah dicatat sebelumnya, di luar scope task ini.
- Jangan sentuh layar lain (history, account) — tetap fokus ke alur pencarian rute yang sudah ada.
- Jangan ubah rumus scoring atau logika apa pun di backend — ini murni verifikasi & perbaikan sisi frontend.

## Acceptance criteria

- `crowd_level`, `reliability`, dan `recommendation_score` tampil benar di UI untuk rute yang datanya ada, dan tetap graceful (bukan data palsu) untuk yang belum ada data.
- Urutan rute di UI sesuai urutan `recommendation_score` dari backend, diverifikasi manual.
- Demonstrasi end-to-end lengkap: laporan kepadatan baru memengaruhi tampilan di UI (bukan cuma keliatan di response API mentah lewat curl).
- Semua error path (400/422/502) dari Integration-01 masih berfungsi setelah perubahan adapter — regresi harus dicek satu per satu, bukan diasumsikan otomatis masih jalan.
