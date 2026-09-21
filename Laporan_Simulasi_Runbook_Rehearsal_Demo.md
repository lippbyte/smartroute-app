# Laporan Simulasi Runbook Rehearsal Demo — SmartRoute AI

**Dijalankan:** 7 September 2026
**Metode:** Playwright (Chrome headless) terhadap app yang benar-benar jalan (Expo web `:8081`, backend `:3000`, OTP2 `:8080` di Docker), plus panggilan API langsung untuk mengisolasi lapisan backend dari lapisan UI. Bukan simulasi di atas kertas — semua angka di bawah adalah hasil eksekusi nyata.
**Sumber:** [Runbook_Rehearsal_Demo_SmartRoute.md](Runbook_Rehearsal_Demo_SmartRoute.md)

---

## Ringkasan Eksekutif

| # | Skenario | Status | Alasan |
|---|---|---|---|
| Setup | Checklist Bagian 2 | 🟡 Sebagian | Servis bisa dinyalakan & sehat, tapi 2 item checklist tidak bisa diverifikasi otomatis (lihat detail) |
| 1 | Pencarian rute dasar | 🔴 **Perlu perbaikan sebelum demo** | 2 bug UI konkret ditemukan — lihat di bawah |
| 2 | Laporan kepadatan mengubah rekomendasi | 🔴 **Momen utama demo saat ini TIDAK BISA dilakukan seperti diskenariokan** | Tidak ada UI submit laporan; DAN mekanismenya sendiri secara diam-diam gagal untuk kombinasi stop_id yang paling wajar dipakai |
| 3 | Mode Wisatawan | 🔴 **Fitur tidak ada sama sekali** | Tidak ditemukan jejak kode apa pun |
| 4 | Asisten wayfinding LLM | 🟡 Backend jalan sempurna, tidak ada UI | Bisa didemokan lewat API client, tidak lewat app |
| 5 | Showcase Model 0 | 🟢 Siap, dengan 1 catatan kecil | Video ada, talking point sudah cocok dengan kenyataan data |

**Kesimpulan langsung:** runbook ini ditulis mengasumsikan kapabilitas yang sebagian belum dibangun (mode toggle, UI lapor kepadatan) atau yang mekanismenya diam-diam patah (integrasi crowd→rekomendasi). Kalau dijalankan apa adanya minggu ini tanpa perbaikan, **Skenario 2 dan 3 akan gagal terlihat di depan juri**, dan Skenario 1 akan menampilkan detail yang tidak konsisten dengan talking point-nya sendiri.

---

## Bagian 1: Checklist Setup (Runbook §2)

| Item | Hasil |
|---|---|
| Backend + OTP2 jalan, dicek `/health` dulu | ✅ Dites — keduanya bisa dinyalakan dan sehat. **Catatan:** backend mati sendiri kalau laptop restart (proses Node biasa); OTP2 sekarang auto-restart kalau containernya crash (Task Ops-01), tapi kalau laptop restart total, tetap perlu `docker compose up -d` manual sekali. Jadwalkan cek ini di pagi hari presentasi, bukan asumsi masih hidup dari sesi sebelumnya. |
| `departure_time` tiap skenario ditentukan & dicatat | ❌ **Tidak bisa dilakukan sama sekali lewat app** — lihat temuan Skenario 1 di bawah. Tidak ada field/UI apa pun untuk mengisi ini; `fetchRealRoutes()` selalu dipanggil tanpa `departureTime` walau parameternya sudah ada di service layer. |
| Frontend dites sekali penuh sebelum juri datang | ✅ Ini persis yang laporan ini lakukan — tapi baru sekarang, bukan sebelumnya. Rekomendasi: jadikan bagian dari checklist H-1. |
| OpenRouter API key aktif & kuota cukup | ✅ Dites — panggilan real ke `/assistant/ask` berhasil, jawaban relevan & akurat (lihat Skenario 4). |
| 3 video Model 0 sudah di-load lokal | 🟡 Ada, tapi belum ada 1 versi final yang dipilih untuk video ketiga — lihat Skenario 5. |
| Koneksi internet cadangan (hotspot) | ⬜ Tidak bisa diverifikasi otomatis — ini keputusan/persiapan fisik tim, bukan sesuatu yang bisa saya tes dari sini. |

---

## Bagian 2: Temuan Per Skenario

### Skenario 1 — Pencarian rute dasar (Blok M → Kota)

**Yang dites:** ketik "blok m" dan "kota" di autocomplete, tap saran, cari rute.

**Temuan 1 (kritis, salah tempat) — kata kunci "kota" polos salah sasaran total.**
Mengetik **"kota"** di field Tujuan menghasilkan saran teratas **"East Jakarta"** (area administratif luas di Cililitan), BUKAN halte Kota/Kota Tua yang dimaksud korridor 1. Rute yang dihasilkan jadi rute 99–114 menit dengan 1 transfer via Pancoran — bukan rute BRT langsung Koridor 1 yang jadi contoh andalan (di README OTP2 sendiri, dan di talking point runbook ini).

Kata kunci yang **benar** (sudah dites, berhasil): **"Halte Kota"** — mengarah tepat ke area Taman Sari/Kota Tua, dan menghasilkan rute Koridor 1 langsung (Asean → Kali Besar, 0 transfer, sesuai ekspektasi).

> **Tindakan:** perbarui skrip presentasi/catatan tim — ketik persis **"Halte Kota"**, bukan "kota" atau "stasiun kota" (dites juga, salah sasaran ke Kampung Bandan, Jakarta Utara).

**Temuan 2 (kritis, bukti empiris nyata) — `departure_time` tidak di-pin, hasil terbukti berubah-ubah.**
Rute Blok M → Halte Kota yang sama, dites jam 07:45 WIB, menghasilkan **91–105 menit**. Referensi resmi di README OTP2 (`otp2-setup/README.md`, rute identik, jam 09:00) mencatat **~70–75 menit**. Ini bukan salah ukur — ini justru pembuktian langsung risiko yang sudah diperingatkan runbook sendiri ("pelajaran dari bug Backend-03b"), dan sekarang terbukti nyata: **tidak ada satu pun field di UI untuk mengunci `departure_time`.** `routeService.ts` sudah punya parameter `departureTime?` yang siap dipakai, tapi `route.tsx` tidak pernah mengirimkannya.

> **Tindakan:** ini butuh perubahan kode kecil sebelum rehearsal pertama — kalau tidak, hasil rehearsal dan hasil demo beneran dijamin beda, persis skenario yang ingin dihindari runbook.

**Temuan 3 (sedang) — talking point "rentang waktu tempuh" tidak benar-benar ditampilkan.**
Backend **sudah** menghitung rentang yang benar (`travel_time_minutes: {min: 91, max: 105}`), tapi layar cuma menampilkan **"91 mnt"** — angka tunggal. ini adalah *technical debt yang sudah didokumentasikan* di `routeService.ts` (komentar "TEMPORARY SHIM", sejak Task Integration-01) sebagai keputusan sengaja ditunda untuk dibahas dengan frontend owner — bukan regresi baru. Tapi karena Skenario 1 talking point-nya eksplisit **"kami jujur soal ketidakpastian waktu tempuh... bukan angka tunggal"**, gap ini sekarang langsung bertentangan dengan kalimat yang akan diucapkan presenter.

> **Tindakan:** perlu keputusan — perbaiki tampilannya (perubahan kecil: `RouteItem.travel_time_minutes` jadi `{min,max}`, update 2 titik render di `route.tsx`), atau ubah talking point-nya kalau tidak sempat.

**Temuan 4 (kosmetik, tapi terlihat di depan juri) — header hasil rute menampilkan koordinat mentah.**
"Hasil Rute" menampilkan `-6.24487,106.80093 → -6.13685,106.81509`, bukan "Blok M → Halte Kota". Berasal dari field `name` di respons `/routes` backend yang memang diisi string koordinat. Sudah pernah dicatat sebagai temuan terpisah sejak App-06/Ops-01.

---

### Skenario 2 — Laporan kepadatan mengubah rekomendasi (Kalideres → PGC)

**Ini "momen utama" demo menurut runbook sendiri — dan saat ini paling bermasalah.**

**Bagian yang berhasil:** pencarian awal Kalideres → PGC memang menghasilkan **persis 2 kandidat dengan skor identik** (0.515 dan 0.515) — cocok sempurna dengan skenario "2 kandidat, skor mirip" di runbook. Titik transfer di kedua kandidat: halte **Gerbang Pemuda Arah Timur**.

**Temuan 1 (blocker keras) — tidak ada UI untuk submit laporan kepadatan sama sekali.**
`crowd-map.tsx` dan `crowdService.ts` cuma punya fungsi **membaca** (`GET /crowd-reports`) — tidak ada form, tombol, atau layar apa pun untuk **mengirim** laporan baru. Satu-satunya cara mengirim laporan saat ini adalah `curl` langsung ke backend. Runbook eksplisit meminta **"lewat UI, bukan curl"** — itu belum ada untuk dilakukan.

**Temuan 2 (blocker keras, lebih dalam) — bahkan kalau UI-nya ada, mekanismenya kemungkinan besar tetap gagal.**
Diuji di level API (untuk mengisolasi masalah): submit laporan "padat" ke halte transfer via `stop_id` yang wajar dipakai (`H00219S`, ID yang sama persis dipakai fitur Peta Kepadatan / `stops.txt` GTFS) — **hasil pencarian rute ulang sama sekali tidak berubah** (skor tetap 0.515, tidak ada field `crowd_level` di respons). Ditelusuri sampai akar: OTP2 ternyata mengidentifikasi halte itu dengan gtfsId **`1:G00080`** — bukan `H00219S` maupun `1:H00219S`. Baru setelah laporan disubmit dengan `1:G00080` (ID internal OTP2, didapat lewat query GraphQL langsung — mustahil diketahui pengguna biasa), skor benar-benar berubah (0.515 → **0.34**) dan `crowd_level: "high"` muncul.

**Kesimpulan:** GTFS TransJakarta punya beberapa representasi ID berbeda untuk lokasi fisik yang sama (varian `H0xxxx` yang dipakai fitur Peta Kepadatan, vs varian `G0xxxx` yang dipilih OTP2 secara internal saat merutekan). Dua bagian sistem ini **tidak pernah saling mencocokkan ID satu sama lain** di kode manapun yang saya temukan. Ini bukan salah satu halte saja — ini gap arsitektur antara Task Backend-04 (crowd) dan Task Backend-06 (routing/skor), jadi kemungkinan besar berlaku sistemik, bukan cuma untuk "Gerbang Pemuda Arah Timur".

> **Tindakan — ini prioritas tertinggi dari seluruh laporan ini.** Tanpa perbaikan, momen paling penting di seluruh presentasi (index bahkan disebut runbook sebagai "bagian paling penting untuk ditunjukkan") tidak mungkin berhasil dipertunjukkan live, videopun kalau direkam sekarang akan merekam kegagalan. Perlu: (a) UI submit laporan, dan (b) titik sambung ID yang benar antara stop yang dipilih user dan gtfsId yang dipakai OTP2 untuk rute itu.

---

### Skenario 3 — Mode Wisatawan (Grogol → Kampung Melayu)

**Temuan (blocker keras) — fitur ini tidak ada sama sekali.**
Pencarian menyeluruh untuk "mode", "komuter", "wisatawan", "tourist" di seluruh source frontend: nihil. Tidak ada toggle, tidak ada state, tidak ada dua varian tampilan instruksi. Satu-satunya alur pencarian rute yang ada adalah yang sudah dites di Skenario 1 — tidak ada pembeda "Komuter" vs "Wisatawan".

> **Tindakan:** ini bukan bug untuk diperbaiki, ini fitur yang belum pernah dibangun. Perlu keputusan sadar: bangun dari nol (butuh estimasi waktu tersendiri), atau coret skenario ini dari urutan presentasi kalau waktu tidak cukup — runbook sendiri menyebut kemungkinan ini di §5 ("apakah 5 skenario semua muat, atau perlu dipangkas jadi 3").

---

### Skenario 4 — Asisten wayfinding LLM

**Dites langsung:** `POST /assistant/ask` dengan pertanyaan persis dari runbook ("dari Blok M ke Kota naik apa?").

**Hasil: berhasil sempurna di level backend.**
```
Dari Blok M ke Kota, Anda bisa naik:
Rute 1 (BRT) — Blok M - Kota
- Tarif: Rp3.500
Ini adalah rute langsung yang menghubungkan kedua lokasi tersebut.
```
Jawaban relevan, akurat (sesuai data GTFS asli), dan cepat. OpenRouter API key aktif dan berfungsi.

**Temuan (sedang) — tidak ada UI chat/tanya-jawab di app.**
Sama seperti Skenario 2 dan 3: kapabilitasnya nyata dan berfungsi, tapi tidak ada cara memanggilnya dari dalam aplikasi. Untuk mendemokan ini "live" seperti diminta runbook, presenter perlu memakai API client terpisah (Postman/terminal) yang ditampilkan ke layar — bukan dari dalam app SmartRoute AI itu sendiri.

> **Perlu keputusan Anda:** apakah demo lewat terminal/Postman itu bisa diterima secara presentasi (masih "live", masih meyakinkan), atau ini perlu UI chat sederhana dulu sebelum rehearsal pertama.

---

### Skenario 5 — Showcase Model 0 (Computer Vision)

**Video "2 kandidat terbaik":** ada dan siap — `task-01-model0-mini/results/demo_videos/BEST_DEMO/01_BEST_12752510_platform_kereta.mp4` dan `02_BEST_12492823_eskalator_stasiun.mp4`. Sudah diverifikasi (dari laporan Model0-03 sebelumnya) sebagai overlay dengan counter, bukan video mentah.

**Talking point vs kenyataan data — cocok, tidak perlu diubah.**
Sempat saya kira ada potensi kontradiksi (talking point bilang "bukan rekaman halte Jakarta"), tapi setelah dicek ke `Task_01b_Validasi_Video_Nyata.md`: video real-footage itu MEMANG sengaja direkam di "tempat umum sekitar tim (kampus, mal, terminal angkot) — tidak harus Jakarta". Talking point runbook sudah pas dengan kenyataan ini.

**Temuan (kecil) — video ketiga (real-footage) belum ada versi overlay final yang dipilih.**
Ada **3 percobaan berbeda** tersimpan (`VID_20260827_105315` di folder `-1`/`-2`/`-3`), masing-masing `.avi` ~210MB, tidak ada satu pun yang ditandai sebagai final. Task 01c bahkan sudah mewanti-wanti "bersihkan folder lama, supaya tidak menumpuk file besar" — sepertinya belum sempat dilakukan.

> **Tindakan:** tonton ketiganya, pilih satu, hapus 2 sisanya, dan pertimbangkan konversi ke `.mp4` (format overlay saat ini `.avi`, kurang universal untuk software presentasi dibanding 2 video lain yang sudah `.mp4`).

---

## Bagian 3: Rencana Cadangan (Runbook §3) — belum bisa dites

Video rekaman lengkap end-to-end, screenshot/GIF cadangan, dan pembagian peran pegang-teknis adalah keputusan/kerja manusia, bukan sesuatu yang bisa saya jalankan atau verifikasi dari sini. Yang bisa saya tegaskan: **merekam video cadangan sekarang, sebelum bug Skenario 2 & 3 diperbaiki, berarti video cadangan itu akan menunjukkan kegagalan yang sama** — urutan yang masuk akal adalah perbaiki dulu, baru rekam.

---

## Bagian 4: Prioritas Tindakan (urutan yang saya sarankan)

1. **[Kritis]** Perbaiki penyambungan ID crowd-report ↔ gtfsId OTP2 (Skenario 2, Temuan 2) — tanpa ini, momen utama demo mustahil, dengan atau tanpa UI.
2. **[Kritis]** Bangun UI submit laporan kepadatan (Skenario 2, Temuan 1) — perlu untuk poin 1 di atas bisa dipakai lewat app, bukan curl.
3. **[Tinggi]** Tambah field/mekanisme pin `departure_time` di UI pencarian rute (Skenario 1, Temuan 2) — servis layer sudah siap, tinggal disambungkan.
4. **[Sedang]** Putuskan nasib Skenario 3 (bangun fitur mode, atau coret dari urutan presentasi).
5. **[Sedang]** Perbaiki tampilan rentang waktu tempuh, atau ubah talking point Skenario 1 (Temuan 3) — diskusikan dengan frontend owner sesuai catatan shim yang sudah ada.
6. **[Sedang]** Putuskan cara presentasi Skenario 4 (lewat app vs API client).
7. **[Rendah]** Perbaiki tampilan asal/tujuan di header Hasil Rute (nama tempat, bukan koordinat).
8. **[Rendah]** Pilih 1 video final untuk real-footage Model 0, bersihkan sisanya.

Saya bisa langsung mulai kerjakan item mana pun di atas begitu Anda konfirmasi urutan/prioritasnya — beberapa (terutama #3 pin departure_time, #7 header nama tempat) kecil dan cepat; #1+#2 (mekanisme crowd→rekomendasi + UI-nya) yang paling besar.
