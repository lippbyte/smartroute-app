# Task 02: Validasi Akurasi Deteksi — ShanghaiTech Part B

**Tim:** SmartRoute AI — Problem Solver
**Ditugaskan ke:** Lippable (backend, dengan bantuan Claude Code)
**Estimasi:** beberapa jam (task ringan)
**Status:** Siap dieksekusi
**Bergantung pada:** Task 01 (Model 0-mini — YOLO11) sudah selesai

---

## Tujuan

Melakukan sanity-check cepat terhadap akurasi deteksi orang dari YOLO11 pretrained yang sudah dibangun di Task 01, memakai dataset publik **ShanghaiTech Part B** yang sudah punya ground truth berlabel — supaya bisa dibandingkan langsung tanpa hitung manual.

**Penting:** task ini adalah pelengkap, bukan pengganti. Acceptance criteria Task 01 yang masih pending ("jumlah orang terdeteksi masuk akal secara visual", diuji dari video nyata tim) **tetap wajib dituntaskan terpisah** — ShanghaiTech hanya foto diam, tidak bisa memvalidasi tracking, `entered`/`exited`, atau perubahan `crowd_status` seiring waktu.

---

## Lingkup (in scope)

- Unduh **ShanghaiTech Part B** saja (bukan Part A — Part A kepadatan ekstrem, tidak relevan dengan skenario halte/stasiun)
- Ambil sampel kecil (~15–20 gambar dari `test_data/images`), bukan seluruh 716 gambar
- Jalankan deteksi YOLO11 **per-gambar** (bukan tracking — foto lepas tidak punya kesinambungan waktu)
- **Pakai model & confidence threshold yang sama** dari `config.py` Task 01 — jangan bikin config terpisah
- Baca file ground truth (`.mat`) untuk dapat jumlah kepala asli per gambar
- Bandingkan hasil prediksi vs ground truth, hitung error (MAE dan/atau persentase error)
- Cetak/simpan ringkasan hasil perbandingan

## Di luar lingkup (jangan dikerjakan)

- Fine-tuning model ke dataset ini — ini murni validasi, bukan training
- Memakai seluruh dataset (716 gambar) — cukup sampel kecil, task ini memang dibuat ringan
- Part A (kepadatan ekstrem) — di luar skenario yang relevan
- Mencoba memvalidasi tracking/`entered`/`exited`/`crowd_status` dari dataset ini — secara struktural tidak mungkin dari foto diam, tetap butuh video (lihat Task 01)
- Mengintegrasikan ShanghaiTech ke API/endpoint utama — ini skrip validasi berdiri sendiri, sekali jalan

---

## Langkah Teknis

1. Unduh ShanghaiTech Part B (mirror Kaggle `tthien/shanghaitech`, atau Dropbox dari repo GitHub `desenzhou/ShanghaiTechDataset`) — dilakukan manual oleh tim, bukan otomatis dalam skrip.
2. Ekstrak ke folder proyek, mis. `ShanghaiTech/part_B/test_data/images/` dan `.../ground-truth/`.
3. Buat skrip baru `validate_shanghaitech.py` **di dalam proyek Task 01** — pakai ulang model & konfigurasi yang sudah ada di `detector.py`/`config.py`, jangan duplikasi logic.
4. Ambil ~15–20 gambar sampel dari folder test images.
5. Jalankan deteksi per gambar:
   ```python
   results = model(img_path, classes=[0], conf=CONFIG.confidence_threshold)
   predicted_count = len(results[0].boxes)
   ```
6. Baca file `.mat` ground truth yang berpasangan dengan tiap gambar (pakai `scipy.io.loadmat`), ambil jumlah titik anotasi kepala sebagai `actual_count`.
7. Hitung per gambar: `predicted_count`, `actual_count`, error absolut, error persentase.
8. Cetak tabel ringkasan per gambar + agregat (MAE dan MAPE keseluruhan sampel).
9. Simpan hasil ke CSV/JSON supaya bisa dicek ulang tanpa run ulang skrip.

---

## Acceptance Criteria

- [ ] Skrip berjalan independen dari video Task 01 — tidak butuh video sample tim
- [ ] Memakai model & confidence threshold yang sama dari `config.py` Task 01, bukan konfigurasi terpisah
- [ ] Berhasil membaca format ground truth `.mat` dari ShanghaiTech
- [ ] Output menampilkan perbandingan per gambar (prediksi vs asli) dan metrik error agregat (MAE/MAPE)
- [ ] Hanya memproses ~15–20 gambar, bukan seluruh dataset
- [ ] Ada catatan jelas di output/README bahwa hasil ini hanya memvalidasi akurasi deteksi mentah, **bukan** pengganti validasi video dari Task 01

---

## Dependencies / Prasyarat

- `scipy` (untuk membaca file `.mat`)
- Task 01 sudah berjalan (`detector.py`, `config.py` tersedia untuk dipakai ulang)
- ShanghaiTech Part B sudah diunduh manual oleh tim ke folder proyek

---

## Catatan untuk Claude Code

- Pakai ulang model loading & logic deteksi yang sudah ada di `detector.py` dari Task 01 — jangan bangun pipeline deteksi baru dari nol.
- Jangan menambahkan fine-tuning meskipun datasetnya tersedia — di luar scope task ini.
- Kalau format `.mat` ground truth ShanghaiTech ternyata berbeda struktur antar versi mirror yang diunduh, sesuaikan parsing-nya, tapi tujuan akhirnya (dapat jumlah kepala asli per gambar) harus tetap tercapai.
- Setelah task ini selesai, hasilnya dipakai sebagai referensi kalibrasi awal `confidence_threshold` — tapi kalibrasi final tetap menunggu hasil video nyata dari Task 01.

---

*Task berikutnya menyusul dengan penomoran baru: Task 03 (GTFS + OpenTripPlanner routing), Task 04 (skor rule-based), Task 05 (asisten chat LLM), Task 06 (frontend web mobile-first).*
