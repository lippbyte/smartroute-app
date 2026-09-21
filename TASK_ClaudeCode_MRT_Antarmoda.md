# TASK Claude Code — SmartRoute AI
## MRT + Antarmoda (TJ + KRL + MRT) dan Export GTFS ke Sheet

Baca seluruh file ini dulu, lalu kerjakan task sesuai urutan. **Jangan menebak struktur repo.** Cek file yang benar-benar ada sebelum mengubah apa pun. Laporkan ke saya setiap kali satu task selesai.

---

## Konteks singkat

- App: Expo Router (web-first) + backend Node.js + OTP2 (GTFS).
- Yang sudah jalan: TransJakarta (full), KRL (sudah masuk OTP2, 83 stasiun; bug `RAIL` di skema backend sudah diperbaiki di Track 1).
- MRT **belum** bisa dirutekan. Belum ada GTFS MRT.
- Bayu membuat 3 spreadsheet (TJ, BRT TJ, KRL). Format spreadsheet Bayu menjadi acuan format export.

Link sheet Bayu:
- TJ: https://docs.google.com/spreadsheets/d/1Nm4xArdznNbXFjmsA7rOG902463jBn3u
- BRT TJ: https://docs.google.com/spreadsheets/d/1RtF9VIfJkp472ePWLPKGRsuI2_VvZDNZ
- KRL: https://docs.google.com/spreadsheets/d/1sNA8w_8XYoYdULtQsGHyTnftutLwDMd4

---

## TASK 0 — Ambil dan pelajari sheet Bayu

1. Download ketiganya sebagai xlsx ke `data/sources/bayu/` (coba URL `.../export?format=xlsx`; kalau butuh login, berhenti dan minta saya download manual).
2. Untuk tiap file, catat: nama tab, header kolom tiap tab, jumlah baris. Tulis ke `data/sources/bayu/STRUKTUR.md`.
3. Bandingkan dengan GTFS yang **sekarang dipakai OTP2** (cari folder feed di `otp2-setup/`):
   - Apakah sheet TJ/KRL Bayu = data yang sudah ada di OTP2, atau versi berbeda?
   - Apakah "BRT TJ" itu subset dari feed TJ (koridor utama) atau feed terpisah?
4. **Jangan mengganti feed apa pun di OTP2 pada task ini.** Laporkan temuan dulu.

Selesai jika: `STRUKTUR.md` ada, dan laporan menjawab dua pertanyaan di poin 3.

---

## TASK 1 — Script export GTFS → xlsx (format Bayu)

Buat script (lokasi mengikuti folder script yang sudah ada, misal `backend/otp2-krl-experiment/scripts/`):

```
gtfs_to_xlsx <folder_gtfs> <output.xlsx>
```

- Satu tab per file GTFS (`agency`, `stops`, `routes`, `trips`, `stop_times`, `calendar`, `fare_attributes`, `fare_rules`, `transfers`, `shapes`, `frequencies` jika ada).
- Urutan tab dan nama kolom mengikuti `STRUKTUR.md` dari Task 0. Kolom yang ada di sheet Bayu tapi tidak ada di GTFS → dibiarkan kosong, jangan diisi karangan.
- Tab besar (`stop_times`) harus tetap terbuka di Google Sheets (batas 10 juta sel). Kalau terlalu besar, beri peringatan.
- Arah sebaliknya (`xlsx_to_gtfs`) juga dibuat, supaya perubahan Bayu di sheet bisa dikonversi balik lalu divalidasi.

Selesai jika: export feed KRL yang sekarang → xlsx → balik ke GTFS menghasilkan file identik (round-trip test).

---

## TASK 2 — Bangun GTFS MRT Jakarta (fase 1 saja)

**Cakupan: hanya jalur yang beroperasi, Lebak Bulus – Bundaran HI, 13 stasiun:**
Lebak Bulus, Fatmawati, Cipete Raya, Haji Nawi, Blok A, Blok M, ASEAN, Senayan, Istora, Bendungan Hilir, Setiabudi, Dukuh Atas, Bundaran HI.

Aturan data (penting, jangan dilanggar):
- **Koordinat**: ambil dari OSM Overpass (`railway=station` + `station=subway`), sama seperti cara KRL digeocode. Catat sumber per stasiun.
- **Jadwal**: pakai `frequencies.txt` (headway) karena jadwal per trip tidak tersedia. Ambil jam operasional, headway jam sibuk/biasa, dan waktu tempuh ujung-ke-ujung dari sumber resmi jakartamrt.co.id. Kalau tidak bisa diverifikasi, tulis nilai sementara di file konfigurasi dengan komentar `TODO: verifikasi` dan laporkan ke saya. **Jangan mengarang angka lalu menyajikannya sebagai data resmi.**
- **Tarif**: MRT memakai tarif berbasis jarak. Pakai tabel tarif resmi; kalau tidak dapat, tandai `TODO: verifikasi` seperti di atas.
- `route_type = 1` (subway/metro).
- Jalur lanjutan (fase 2 ke Kota) **tidak** dimasukkan karena belum beroperasi.
- Transfer: tambahkan `transfers.txt` untuk titik temu dengan moda lain yang memang ada di graph, minimal Dukuh Atas (↔ KRL Sudirman/BNI City, TJ Dukuh Atas) dan Blok M (↔ TJ Blok M), dengan waktu jalan kaki realistis.

Output:
- Folder GTFS MRT (ikuti pola folder KRL).
- Lulus validator yang sama dengan KRL (`validate_krl_gtfs.py` atau diadaptasi), 0 error.
- xlsx hasil Task 1 untuk dikirim ke Bayu: `GTFS_MRT_Jakarta.xlsx`.

---

## TASK 3 — MRT masuk OTP2 + backend

1. Backup graph dulu (`graph.obj.backup-pre-mrt`, `build-config.json.backup-pre-mrt`), sama seperti saat KRL.
2. Tambah feed MRT ke build config, rebuild graph. Catat jumlah Stops/Patterns sebelum dan sesudah.
3. **Cek bug yang sama seperti KRL**: OTP2 kemungkinan mengirim mode `SUBWAY`. Pastikan skema, validasi, reliability scoring, chat asisten, dan label frontend menerima `SUBWAY`. Dulu `RAIL` ditolak dan semua rute KRL jadi HTTP 500 — jangan terulang.
4. Tarif: tambah perhitungan tarif MRT per leg. Untuk perjalanan campuran moda, jumlahkan per moda. Jangan asumsikan tarif integrasi JakLingko kecuali ada sumbernya; kalau ada, jadikan catatan saja dulu.
5. Chat asisten: pastikan konteks yang dikirim ke LLM memuat leg MRT, dan jawaban tetap hanya berdasarkan hasil routing (grounding tidak boleh rusak).

Selesai jika: rute yang melewati MRT kembali HTTP 200 dengan leg `SUBWAY`, tarif tidak dobel, tidak ada regresi pada 3 skenario demo lama (Blok M→Kota, Senen→Grogol, Grogol→Kp. Melayu).

---

## TASK 4 — UI hasil rute antarmoda

Cek dulu komponen kartu hasil rute yang ada sekarang (kemungkinan di `app/route/`). Lalu:

1. **Label & warna per moda** di setiap leg: TransJakarta (BUS), KRL (RAIL), MRT (SUBWAY), Jalan kaki (WALK). Pakai satu sumber mapping di satu file, jangan disebar.
2. **Ringkasan rantai moda** di kartu, contoh: `Jalan → MRT → Jalan → KRL`. Pastikan kontras warna tetap lolos WCAG AA.
3. **Titik transfer antarmoda** (misal MRT → KRL di Dukuh Atas) menampilkan indikator risiko transfer yang sudah ada + estimasi jalan kaki.
4. **Filter moda (opsional, kerjakan terakhir)**: chip pilihan TJ / KRL / MRT, default semua aktif, dikirim ke backend sebagai daftar mode OTP2. Jangan sampai alur inti "cari rute" jadi lebih dari 3 tap.
5. Sekalian perbaiki bug lama `route/index.tsx:84-90`: `router.push` ke `/route/[id]` tidak mengirim `id`. Pakai id kandidat rute yang tersedia di data; kalau tidak ada, laporkan ke saya sebelum mengubah.

---

## TASK 5 — Tes

Jalankan ke backend hidup (panaskan OTP2 dulu dengan 3–5 pencarian). Untuk tiap skenario, catat latensi, jumlah kandidat, rantai moda, ETA, tarif:

| # | Asal → Tujuan | Yang dicek |
|---|---|---|
| 1 | Lebak Bulus → Bundaran HI | Rute MRT murni muncul |
| 2 | Fatmawati → Manggarai | MRT → transfer Dukuh Atas → KRL |
| 3 | Lebak Bulus → Kota | Kombinasi MRT + TJ/KRL, tarif dijumlah benar |
| 4 | Blok M → Kota | Regresi skenario demo 1 (sekarang boleh lebih banyak kandidat) |
| 5 | Senen → Grogol + lapor padat Kwitang | Regresi skenario demo 2, urutan tetap berbalik |
| 6 | Chat: "Dari Fatmawati ke Manggarai naik apa?" | Jawaban menyebut MRT + KRL sesuai hasil routing |

Jangan menyesuaikan angka di laporan agar "terlihat bagus". Kalau hasil OTP2 berbeda dari ekspektasi, tulis apa adanya.

---

## Laporan akhir yang saya minta

1. Jawaban Task 0 (BRT = subset atau feed terpisah? sheet Bayu sama dengan data OTP2 atau beda?).
2. Daftar semua nilai bertanda `TODO: verifikasi` (jadwal/tarif MRT).
3. Stops/Patterns OTP2 sebelum vs sesudah MRT.
4. Tabel hasil Task 5.
5. Cara rollback kalau MRT bermasalah saat demo.
