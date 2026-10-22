# Task Integration-01: Sambungkan Frontend ke Backend Asli (Sementara)

**Assignee:** Lippable (sementara — pemilik aslinya tim frontend; diambil alih dulu supaya progress backend kelihatan tanpa menunggu semua fitur backend selesai)
**Prasyarat:** Backend `/routes` sudah jalan (Task Backend-03c selesai: routing + tarif flat + `departure_time`). `crowd_level` dan `reliability` masih `undefined` karena Task Backend-04/05 belum dikerjakan — ini status yang diharapkan, bukan bug.

## Tujuan

Ganti sumber data di satu alur frontend (pencarian rute) dari `mockApiResponse` ke panggilan nyata ke `POST /routes`, supaya progress backend kelihatan langsung di UI tanpa menunggu Backend-04/05/asisten LLM selesai dulu.

## Konteks

Ini murni kerja integrasi/testing, bukan pengembangan fitur baru. Karena skema data frontend (`src/type.ts`) dan skema backend (`RouteRecommendation`/`RouteCandidate`) berbeda struktur — sudah dibahas dan didokumentasikan sebelumnya — task ini menjembataninya lewat adapter sementara, **bukan** menulis ulang komponen UI yang sudah ada. Rekonsiliasi skema yang sebenarnya adalah keputusan terpisah yang perlu dibahas bersama pemilik frontend, di luar task ini.

## Lingkup

- Tambah fungsi `fetchRealRoutes(origin, destination)` yang memanggil `POST http://localhost:3000/routes` (sesuaikan base URL kalau testing di device fisik, bukan emulator/browser lokal).
- Tulis satu fungsi adapter kecil, `adaptToLegacyShape()`, yang mengubah response `RouteRecommendation` (backend) menjadi bentuk `ApiResponse`/`RouteItem` (frontend) yang sudah dipakai komponen-komponen sekarang — supaya komponen UI yang ada tidak perlu ditulis ulang di task ini.
  - Beri komentar eksplisit di kode: `// TEMPORARY SHIM — hapus begitu tim frontend update type.ts langsung ke skema backend`.
- Tangani `crowd_level`/`reliability` yang `undefined` dengan graceful: tampilkan "Data belum tersedia" atau sembunyikan bagian terkait — **jangan** isi angka dummy/tebakan supaya terlihat lengkap.
- Ganti satu layar (alur pencarian/hasil rute) dari `mockApiResponse` ke `fetchRealRoutes`, verifikasi end-to-end: input asal-tujuan nyata → hasil dari OTP2 beneran muncul di UI.

## Batasan eksplisit

- Jangan ubah `type.ts` atau komponen UI lain di luar yang benar-benar perlu untuk menampilkan data asli — perubahan skema permanen adalah keputusan yang harus dibahas dulu dengan pemilik frontend, bukan diputuskan sepihak di task ini.
- Jangan kerjakan integrasi ke semua layar (history, account, dll) — cukup satu alur inti pencarian rute.
- Jangan "perbaiki" tampilan waktu tempuh jadi rentang (`min`–`max`) di task ini kalau itu butuh perubahan komponen yang signifikan — cukup catat sebagai temuan untuk pemilik frontend. Task ini fokus ke "tersambung dan jalan", bukan "sempurna".

## Acceptance criteria

- Input asal-tujuan nyata di UI menghasilkan response dari backend beneran (bukan mock), diverifikasi manual minimal untuk 1 rute.
- Field yang belum ada (`crowd_level`, `reliability`) ditangani dengan graceful — tidak crash, tidak diisi data palsu.
- Adapter shim diberi komentar jelas sebagai kode sementara, bukan solusi akhir.
