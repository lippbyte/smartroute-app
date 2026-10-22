# TASK Claude Code — SmartRoute AI
## Label Antarmoda + Tarif JakLingko + LRT Jabodebek

Baca seluruh file ini dulu. Laporkan tiap task selesai sebelum lanjut ke berikutnya.

Konteks: laporan sebelumnya (tabel "Bisa dirutekan?") menyebut KRL/BRT/Feeder/JakLingko sudah bisa dirutekan tapi BRT+Feeder+JakLingko semua berlabel "TransJakarta"; JakLingko tarif salah tampil Rp3.500 padahal GTFS resmi gratis (Task Backend-13); MRT rutenya bisa tapi "tampilannya salah" (detail terpotong saat diteruskan ke saya); LRT Jabodebek belum ada feed sama sekali, hanya koordinat stasiun untuk peta.

Sebelum mulai: cek `git status` di repo frontend — Lippable kemungkinan masih punya perubahan belum selesai di file yang tumpang tindih (routeService.ts, RouteCard.tsx, type.ts, dll., dari temuan sesi sebelumnya). Jangan sentuh atau timpa perubahan itu.

---

## TASK 0 — Tuliskan ulang detail bug tampilan MRT

Laporan asalmu soal "MRT: rutenya bisa, tampilannya salah — detail di bawah" tidak ikut terkirim utuh ke saya. Tulis ulang detailnya di sini dulu, sebelum diperbaiki. Jangan menebak atau langsung memperbaiki tanpa ini jelas.

---

## TASK 1 — Label & ikon per sub-moda TransJakarta

Satu feed "TransJakarta" saat ini menaungi 3 kategori berbeda: BRT (koridor 1–14), Feeder (~118 rute), JakLingko/Mikrotrans (98 rute, pola `JAK.*`).

1. Konfirmasi pola pembeda di GTFS yang sudah ada (`route_id`/`agency_id`/`route_short_name`) untuk memisahkan ketiga kategori secara terprogram. JakLingko sudah diketahui pola `JAK.*` — cari pola serupa untuk membedakan BRT vs Feeder (kemungkinan dari penomoran koridor vs penomoran rute feeder, atau field lain di GTFS).
2. Terapkan label berikut (baseline usulan, bisa diubah lewat satu titik konfigurasi kalau keputusan akhir beda):
   - BRT koridor 1–14 → tetap **"TransJakarta"**
   - Feeder → **"TransJakarta Feeder"** (atau label lain yang jelas beda dari BRT)
   - JakLingko/Mikrotrans → **"JakLingko"**
3. Ikon/warna berbeda untuk ketiga kategori, konsisten dengan konvensi ikon yang sudah dipakai (moda lain seperti KRL/MRT sudah punya ikon sendiri).
4. Taruh mapping ini di SATU file/tempat, bukan tersebar — supaya kalau label akhir berubah, tidak perlu cari ke banyak file.

---

## TASK 2 — Perbaiki tarif JakLingko (Task Backend-13)

1. Rute berpola `JAK.*` → tarif Rp0, sesuai GTFS resmi.
2. Pastikan ini rilis BARENG Task 1 — rute berlabel "TransJakarta" menampilkan Rp0 akan terlihat seperti bug, rute berlabel "JakLingko" menampilkan Rp0 terlihat benar.
3. Cek kasus JakLingko sebagai salah satu leg di perjalanan multi-moda — pastikan tidak muncul bug penjumlahan tarif yang sama seperti kasus KRL→MRT→KRL sebelumnya (tarif leg lain tidak boleh ikut ter-nol-kan atau dobel).

---

## TASK 3 — Perbaikan bug tampilan MRT (isi dari Task 0)

Kerjakan setelah Task 0 jelas. Jangan asumsikan ini sama dengan masalah SUBWAY yang sudah diperbaiki minggu lalu — cek dulu apakah ini masalah baru atau regresi dari perbaikan sebelumnya.

---

## TASK 4 — Bangun LRT Jabodebek: feed + integrasi OTP2

**Jangan asumsikan jumlah lin/stasiun dari ingatan siapa pun** — proyek ini sudah pernah kena masalah data transit yang dikarang lalu disajikan seolah terverifikasi (spesifikasi MRT pertama). Riset ulang dari nol, sama disiplinnya dengan proses MRT:

1. **Cakupan:** hanya segmen yang benar-benar beroperasi saat ini. Riset via OSM Overpass + sumber resmi (situs LRT Jabodebek/KAI, bukan cuma satu sumber sekunder) untuk: jalur aktif, daftar stasiun, jadwal/headway, tarif.
2. **Sheet Bayu "LRT Jabodebek"** — sebelumnya dikonfirmasi Khalifa dibuat untuk Model 01 (ML training), bukan untuk routing, jadi kemungkinan formatnya beda dari GTFS. Baca strukturnya dulu (sama seperti Task 0 di task MRT dulu — cek tab/kolom), pakai sebagai cross-check kalau berguna, tapi JANGAN jadikan satu-satunya sumber data routing — bangun feed dari OSM+sumber resmi secara independen, sama seperti MRT.
3. Nilai yang tidak bisa diverifikasi → tulis `TODO: verifikasi` di file konfigurasi, laporkan, jangan dikarang.
4. `route_type` yang sesuai untuk light rail — cek konsistensi dengan pilihan yang dipakai MRT, atau tentukan yang benar secara teknis untuk LRT spesifik kalau berbeda.
5. Validasi dengan validator GTFS yang sama (0 error).
6. Integrasi ke OTP2 dengan pola yang sudah terbukti: backup graph dulu (`graph.obj.backup-pre-lrt`), build di container staging terpisah, jalankan regresi penuh sebelum swap, auto-rollback kalau gagal — sama seperti proses MRT.
7. Mode LRT kemungkinan butuh penanganan di tempat yang sama seperti SUBWAY (MRT) dulu: skema, validasi, reliability scoring, asisten chat, ID rute, label, tarif — cek ketujuh titik itu satu per satu, jangan cuma tempat yang kelihatan jelas.
8. **Commit `build-config.json` versi LRT ke repo SEGERA setelah build sukses** — jangan ulangi kesalahan MRT kemarin (build-config sempat tidak ter-commit, rebuild dari repo akan diam-diam kehilangan MRT tanpa error).

---

## TASK 5 — UI hasil rute: skalakan ke 6 moda

Setelah Task 1–4, satu hasil rute bisa memuat sampai 6 label berbeda: TransJakarta (BRT), TransJakarta Feeder, JakLingko, KRL, MRT, LRT.

1. Satu file mapping ikon/warna/label per moda (bukan tersebar di banyak komponen) — ini sudah jadi syarat di task multi-modal sebelumnya, makin penting sekarang dengan lebih banyak moda.
2. **Jangan putuskan sendiri** apakah selector moda di UI menampilkan 6 toggle terpisah, atau dikelompokkan (mis. "Bus" = BRT+Feeder+JakLingko jadi satu toggle, plus KRL/MRT/LRT terpisah). PRD mensyaratkan alur inti "cari rute" selesai maksimal 3 tap — 6 toggle kemungkinan melanggar itu. Laporkan opsi ke saya/Amelia untuk diputuskan, implementasikan yang dipilih.

---

## TASK 6 — Regresi

Setelah semua perubahan: jalankan ulang S1 (Blok M→Kota), S3 (Grogol→Kp. Melayu), Pasar Baru→Lebak Bulus+laporan Monas — pastikan tidak ada yang bergeser dari hasil yang sudah diuji. Tambahkan minimal 1–2 skenario uji baru untuk LRT begitu stasiun aktualnya terverifikasi di Task 4 (jangan pakai nama stasiun tebakan).

---

## Laporan akhir yang saya minta

1. Detail bug MRT (Task 0) + status perbaikannya (Task 3)
2. Pola pembeda BRT/Feeder/JakLingko yang ditemukan (Task 1)
3. Konfirmasi tarif JakLingko benar di kasus tunggal dan multi-leg (Task 2)
4. Daftar `TODO: verifikasi` untuk LRT (jadwal/tarif/apa pun yang tidak bisa dipastikan)
5. Stops/Patterns OTP2 sebelum vs sesudah LRT masuk
6. Tabel hasil regresi (Task 6)
7. Opsi UI selector 6-moda untuk diputuskan (Task 5)
