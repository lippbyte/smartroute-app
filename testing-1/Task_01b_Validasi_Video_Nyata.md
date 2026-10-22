# Task 01b: Validasi dengan Video Nyata (menutup Task 01)

**Tim:** SmartRoute AI — Problem Solver
**Ditugaskan ke:** Lippable (backend, dengan bantuan Claude Code)
**Estimasi:** 3–5 jam (termasuk rekam video)
**Status:** Siap dieksekusi
**Konteks:** Task 01 sudah membangun pipeline deteksi (YOLO11 + tracking), Task 02 sudah membuktikan lewat ShanghaiTech bahwa deteksi berbasis bounding box akurat di kepadatan wajar tapi jatuh drastis di kepadatan ekstrem. Task ini menuntaskan satu acceptance criteria Task 01 yang masih pending: **validasi dengan video nyata**, bukan dummy video atau foto diam.

---

## Tujuan

Membuktikan tiga hal yang tidak bisa dijawab oleh Task 02 (ShanghaiTech), karena itu foto diam tanpa kesinambungan waktu:
1. Jumlah orang terdeteksi masuk akal di video nyata dengan kepadatan sewajar halte/stasiun (bukan kepadatan ekstrem)
2. Tracking (`track_id`) konsisten mengikuti orang yang sama antar frame
3. `entered`/`exited` menghasilkan angka yang masuk akal dibanding yang benar-benar terjadi di video

Sekaligus mengukur waktu proses aktual (di Task 01 masih berupa estimasi, bukan hasil ukur) dan mengkalibrasi ulang threshold kepadatan di `config.py` berdasarkan data nyata, bukan angka default asal tebak.

---

## Lingkup (in scope)

- Rekam 1–2 video pendek (30 detik–2 menit) di tempat umum sekitar tim (kampus, mal, terminal angkot) — tidak harus Jakarta, cukup representatif dari kepadatan wajar (kira-kira 10–40 orang dalam frame, bukan ratusan)
- Idealnya video menangkap orang **bergerak melintasi frame** (bukan cuma kerumunan diam), supaya tracking dan entered/exited benar-benar teruji
- Jalankan lewat `test_video.py` yang sudah ada dari Task 01 — pakai ulang, jangan bangun skrip baru
- Hitung manual jumlah orang di minimal 3 titik waktu berbeda dalam video (misal detik ke-5, ke-15, ke-25), bandingkan dengan hasil model
- Pilih 2–3 individu di video, cek visual apakah `track_id`-nya tetap sama selama mereka terlihat
- Cek apakah `entered`/`exited` yang dihasilkan masuk akal dibanding yang terlihat mata di video
- Kalibrasi ulang `CROWD_DENSITY_THRESHOLDS` dan `MAX_OCCUPANCY_CAPACITY` di `config.py` berdasarkan hasil ini
- Ukur waktu proses aktual (bukan estimasi) untuk durasi video yang dites, catat di README

## Di luar lingkup (jangan dikerjakan)

- Fine-tuning model — kalau hasil validasi ini sudah cukup baik, tidak perlu
- Menyentuh ulang pipeline ShanghaiTech dari Task 02 — itu sudah selesai
- Fitur atau endpoint baru — task ini murni validasi dan kalibrasi, menutup pekerjaan yang sudah ada

---

## Panduan Merekam Video

- **Sudut kamera**: agak dari atas/elevasi kalau bisa (mirip posisi CCTV di stasiun), bukan sejajar mata — supaya lebih representatif
- **Kepadatan**: cari momen dengan cukup banyak orang tapi masih bisa dihitung manual dengan mata (10–40 orang), hindari kerumunan super padat yang sudah kita tahu dari Task 02 bakal gagal dideteksi
- **Pencahayaan**: usahakan cukup terang, bukan indoor gelap
- **Pergerakan**: pastikan ada orang yang masuk-keluar frame selama rekaman, bukan cuma diam di tempat — ini yang membuktikan tracking beneran jalan
- **Izin**: kalau merekam di tempat umum dengan wajah orang lain terlihat jelas, cukup pastikan ini untuk keperluan riset/demo internal, bukan dipublikasikan luas dengan wajah yang mudah dikenali

---

## Langkah Teknis

1. Rekam video sesuai panduan di atas, simpan ke `sample_videos/` di project Task 01.
2. Jalankan `python test_video.py path/to/video_nyata.mp4`.
3. Buka video secara manual (video player biasa), pause di 3–5 titik waktu berbeda, hitung orang dengan mata, catat.
4. Bandingkan hitungan manual dengan `passenger_count.current` dari output model di frame/waktu yang sama.
5. Pilih 2–3 orang yang terlihat cukup lama di video, telusuri `track_id` mereka di output JSON per-frame — pastikan `track_id` tidak berubah-ubah selama orang itu masih terlihat kamera.
6. Bandingkan `entered`/`exited` dari output dengan pengamatan manual (berapa orang yang benar-benar masuk/keluar frame selama video).
7. Berdasarkan hasil no. 3–6, sesuaikan `CROWD_DENSITY_THRESHOLDS` dan `MAX_OCCUPANCY_CAPACITY` di `config.py` supaya level kepadatan (rendah/sedang/tinggi) mencerminkan kepadatan yang benar-benar terlihat di video, bukan angka default lama.
8. Catat waktu proses aktual (`time` command atau timestamp sebelum-sesudah di skrip) untuk durasi video yang dites — update README dengan angka nyata, ganti estimasi "2-4 menit" yang masih dugaan.
9. Update status acceptance criteria di dokumentasi Task 01 — tandai item "jumlah orang terdeteksi masuk akal secara visual" sebagai selesai, sertakan ringkasan hasil sebagai bukti.

---

## Acceptance Criteria

- [ ] Minimal 1 video nyata (bukan dummy, bukan foto) dipakai untuk testing
- [ ] Hasil hitungan model dibandingkan hitungan manual di minimal 3 titik waktu, selisihnya dicatat
- [ ] Tracking diverifikasi: minimal 2–3 individu dicek `track_id`-nya konsisten selama muncul di video
- [ ] `entered`/`exited` dicek masuk akal dibanding pengamatan manual di video
- [ ] Threshold kepadatan di `config.py` dikalibrasi ulang berdasarkan video nyata
- [ ] Waktu proses aktual diukur dan dicatat di README (bukan estimasi)
- [ ] Status acceptance criteria Task 01 diperbarui mencerminkan hasil ini

---

## Catatan untuk Claude Code

- Pakai ulang `test_video.py`, `detector.py`, `config.py` dari Task 01 — jangan bangun skrip baru dari nol.
- Kalau hasil validasi menunjukkan error besar mirip pola Task 02 (meleset jauh di kepadatan tinggi), itu **hasil yang diharapkan dan sudah sesuai catatan strategi tim** — bukan alasan mengejar fine-tuning atau model crowd-counting baru. Cukup catat dan lanjut, karena modul ini tetap berperan sebagai showcase terpisah, bukan sumber data utama aplikasi.
- Kalau error di kepadatan wajar (10–40 orang) ternyata juga besar, itu baru sinyal perlu penyesuaian confidence threshold — laporkan angkanya sebelum ambil langkah lebih jauh.

---

*Setelah ini selesai, Task 01 dianggap tuntas penuh. Task 03 (GTFS + OpenTripPlanner routing) jadi prioritas berikutnya.*
