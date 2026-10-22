# Task 01c: Output Visual — Bounding Box & Track ID

**Tim:** SmartRoute AI — Problem Solver
**Ditugaskan ke:** Lippable (backend, dengan bantuan Claude Code)
**Estimasi:** 2–4 jam
**Status:** Siap dieksekusi
**Konteks:** Task 01 & 01b sudah membangun pipeline deteksi + validasi, tapi hasilnya cuma angka di JSON/CSV. Validasi manual (cek track_id konsisten, cek entered/exited) jadi sulit karena harus menebak dari angka mentah tanpa melihat langsung siapa yang terdeteksi.

---

## Tujuan

Menambahkan kemampuan menyimpan hasil deteksi sebagai **video/gambar dengan bounding box dan track_id tergambar langsung di layar**, supaya validasi manual bisa dilakukan dengan melihat visual, bukan menebak dari data mentah.

---

## Lingkup (in scope)

- Aktifkan opsi penyimpanan visual bawaan Ultralytics (parameter `save=True` di `model.track()`) — jangan bangun anotasi kotak manual dari nol, Ultralytics sudah punya ini built-in.
- Pastikan output video/gambar menampilkan: bounding box, `track_id`, dan confidence score per deteksi di setiap frame.
- Tambahkan opsi aktif/nonaktif untuk fitur ini (jangan selalu otomatis nyala, karena file video hasil bisa besar) — lewat command-line flag di `test_video.py` dan parameter opsional di API.
- Dokumentasikan lokasi file output dan cara mengaksesnya.

## Di luar lingkup (jangan dikerjakan)

- Tidak mengubah logic deteksi/tracking yang sudah ada — ini murni tambahan visual, bukan mengubah hasil angka.
- Tidak membangun dashboard/UI web untuk menonton video — cukup file tersimpan lokal, dibuka manual.
- Tidak menyentuh kalibrasi threshold di `config.py` — itu langkah terpisah setelah video kedua selesai divalidasi.

---

## Langkah Teknis

1. Modifikasi `detector.py`: pass parameter `save=True` (dan `project=`, `name=` untuk kontrol lokasi output) ke pemanggilan `model.track()`.
2. Pastikan file hasil tersimpan di lokasi yang jelas, misal `results/visual_output/` — sebutkan path eksak di README.
3. Update `test_video.py`: tambahkan flag opsional, misal `--save-visual` (default `False`), yang saat diaktifkan akan menghasilkan video beranotasi selain output JSON seperti biasa.
4. Update `api.py`: tambahkan parameter opsional `save_visual` (boolean, default `False`) di endpoint `/detect` dan `/detect/local`; kalau `True`, sertakan path/nama file video hasil di response JSON.
5. Uji dengan video yang sudah ada (video pertama, 1–6 orang/frame) — pastikan file hasil bisa dibuka dan kotak + ID-nya terbaca jelas.
6. Update README: cara mengaktifkan fitur ini, lokasi file output, dan cara membukanya.

---

## Acceptance Criteria

- [ ] `test_video.py` bisa dijalankan dengan opsi untuk menyimpan video hasil dengan bounding box + `track_id` tergambar
- [ ] File video/gambar hasil bisa dibuka dan menampilkan kotak deteksi + nomor `track_id` yang terbaca jelas
- [ ] API punya opsi serupa (opsional, tidak aktif secara default)
- [ ] Angka hasil deteksi (JSON/CSV) tidak berubah — fitur ini murni tambahan, bukan mengubah logic yang sudah ada
- [ ] Sudah diuji dengan video yang sudah direkam sebelumnya, dikonfirmasi bisa dibuka dan dibaca dengan jelas
- [ ] README diperbarui dengan cara pakai dan lokasi file output

---

## Catatan untuk Claude Code

- Manfaatkan fitur `save=True` bawaan Ultralytics semaksimal mungkin — sudah termasuk plotting bounding box dan ID, tidak perlu ditulis manual pakai OpenCV.
- Beri nama file unik per proses (misal berdasar nama video + timestamp), atau bersihkan folder lama, supaya tidak menumpuk file besar tiap kali dites ulang.
- Ini murni alat bantu untuk mempermudah validasi manual Task 01b — bukan fitur yang akan dipakai di aplikasi utama/produksi.

---

*Setelah ini selesai, lanjutkan validasi video kedua (lebih ramai, 15–30 orang) dari Task 01b — kali ini pengecekan track_id dan entered/exited bisa dilakukan sambil menonton video hasil, bukan menebak dari JSON.*
