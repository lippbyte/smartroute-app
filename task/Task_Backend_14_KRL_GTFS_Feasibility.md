# Task Backend-14: Investigasi Kelayakan Integrasi GTFS KRL ke OTP2

**Assignee:** Lippable
**Prioritas: Eksperimen berisiko tinggi — dikerjakan dengan syarat keras di bawah, bukan best-effort bebas.**

## ⚠️ Syarat mutlak sebelum mulai apa pun

**Sistem yang sekarang jalan (graph.obj, OTP2 produksi, semua yang sudah dites/rehearsal) TIDAK BOLEH disentuh atau berisiko rusak.** Semua eksperimen di task ini WAJIB dilakukan di:
- Salinan/instance OTP2 terpisah (port berbeda, folder data berbeda), BUKAN container yang sekarang dipakai app.
- Kalau butuh restart/rebuild apa pun, pastikan itu di instance eksperimen, bukan yang produksi.

Kalau di titik mana pun ternyata eksperimen ini butuh mengutak-atik setup produksi untuk diuji, **berhenti dan laporkan** — jangan lanjut dengan risiko itu.

## Tujuan

Cek apakah dataset KRL (`Data_KRL_JABODETABEK`, sumber resmi kci.id via Kaggle, CC-BY-SA-4.0) bisa dikonversi jadi GTFS dan dimuat ke OTP2 bersamaan dengan TransJakarta — SEBELUM melakukan konversi penuh dan integrasi sungguhan.

## Lingkup Investigasi

1. **Cek kelengkapan data untuk GTFS:**
   - Apakah `schedules_by_train_all.json`/`schedules_by_station_all.json` punya pembedaan jadwal weekday vs weekend/libur, atau cuma satu jadwal generik? Ini menentukan apakah `calendar.txt` GTFS bisa dibuat akurat atau harus disederhanakan (satu jadwal untuk semua hari, dengan batasan ini didokumentasikan jujur).
   - Apakah `fares_all.json` cukup untuk `fare_attributes.txt`/`fare_rules.txt`, atau strukturnya terlalu beda dan perlu pemetaan manual?

2. **Buat GTFS SAMPEL kecil** (bukan penuh 84 stasiun dulu) — cukup untuk beberapa kereta/stasiun yang relevan dekat titik transfer dengan TransJakarta (misal area Manggarai, Sudirman, Tanah Abang) — sebagai bukti konsep konversi format.

3. **Muat GTFS sampel itu ke OTP2 di instance terpisah**, bersamaan dengan GTFS TransJakarta yang sudah ada — cek:
   - Apakah OTP2 berhasil membangun graph dari 2 GTFS feed sekaligus tanpa error?
   - Apakah OTP2 otomatis mengenali transfer jalan kaki antara halte TransJakarta dan stasiun KRL yang berdekatan (lewat OSM), atau perlu `transfers.txt` manual?

4. **Uji satu skenario rute nyata** yang seharusnya menggabungkan TransJakarta + KRL (misal dari halte TransJakarta ke stasiun KRL terdekat, lanjut naik KRL) — lihat apakah OTP2 bisa menghitungnya dengan masuk akal.

## Batasan eksplisit

- **Jangan konversi seluruh 84 stasiun dulu** — cukup sampel kecil untuk uji kelayakan.
- **Jangan sentuh graph/container produksi** — sesuai syarat mutlak di atas.
- **Berhenti dan laporkan** kalau di titik mana pun hasilnya negatif (data tidak cukup lengkap, OTP2 tidak bisa multi-feed, transfer tidak terbentuk) — jangan paksa lanjut ke konversi penuh kalau tanda-tandanya sudah tidak bagus dari sampel kecil ini.

## Acceptance criteria

- Laporan jelas dan jujur: apakah kelayakan ini positif atau negatif, dengan bukti konkret dari sampel kecil (bukan spekulasi).
- Kalau positif: rekomendasi jelas apa langkah konversi penuh berikutnya (task terpisah, belum ditulis sekarang).
- Kalau negatif: laporan jelas alasannya, dan konfirmasi eksplisit bahwa sistem produksi tidak tersentuh sama sekali selama eksperimen ini.
