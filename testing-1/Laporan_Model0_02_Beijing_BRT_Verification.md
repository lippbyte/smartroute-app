# Laporan Task Model0-02: Verifikasi Beijing-BRT Dataset

**Status:** Verifikasi selesai. **Tidak ada training yang dijalankan** (sesuai batasan task).
**Waktu dihabiskan:** riset via web (repo GitHub + README), tidak perlu 2 jam penuh.

## 1. Dataset bisa diakses langsung?

**Ya.** Repo [XMU-smartdsp/Beijing-BRT-dataset](https://github.com/XMU-smartdsp/Beijing-BRT-dataset) adalah repo GitHub publik biasa — bisa langsung `git clone` atau download ZIP, **tidak ada gate request-access/approval dari penulis**. Tidak ada red flag di sisi akses.

Isi repo:
- Folder `frame/` — 1.280 gambar (mis. `1-20170325134657.jpg`), split 720 train / 560 test.
- Folder `ground_truth/` — file `.mat` berpasangan nama dengan tiap gambar.
- File tambahan: `densityMap.m` (skrip MATLAB) dan `pMapN.mat` (density map pre-computed) — ini cuma tools bantu, bukan pengganti anotasi utama.

## 2. Format anotasinya apa persis?

**Titik (point annotation), bukan bounding box, dan bukan density map kontinu.**

Dari README repo: setiap file `.mat` di `ground_truth/` berisi lokasi tiap orang di gambar tersebut, satu baris per orang, format `[x, y]` — ini koordinat titik (kemungkinan head-center), persis seperti dugaan awal di task (dan sama gaya dengan ShanghaiTech `GT_IMG_*.mat` yang sudah pernah dicek di [task-02-validasi-shanghaitech](task-02-validasi-shanghaitech)).

Jadi ini kasus **"titik → perlu konversi ke bounding box"**, bukan kasus stop-total (density map `.mat`/`.h5` kontinu tanpa koordinat diskrit). Ada `pMapN.mat` yang tampaknya density map, tapi ground truth utama per-gambar tetap koordinat titik diskrit → bisa dipakai.

## 3. Estimasi waktu konversi titik → bounding box

Karena datanya cuma titik (tanpa info skala/ukuran orang per titik), ada dua level konversi:

- **Versi cepat (fixed-size box di sekitar titik):** baca `.mat` (scipy.io.loadmat), loop titik, buat box persegi ukuran tetap (mis. 20×40 px) berpusat di titik, clip ke batas gambar, tulis ke format label YOLO (`class cx cy w h` ternormalisasi). Estimasi: **30–60 menit** termasuk uji cepat di beberapa gambar dan sanity-check visual.
- **Versi lebih baik (box adaptif perspektif):** ukuran box diskalakan pakai jarak ke tetangga terdekat (k-NN, gaya geometry-adaptive kernel MCNN) supaya orang yang jauh dapat box kecil, yang dekat dapat box besar. Estimasi tambahan: **+1–2 jam** (perlu tuning parameter, lebih rawan box saling tumpang-tindih di area padat).

Untuk keperluan fine-tuning cepat, versi fixed-size cukup sebagai baseline.

## 4. Estimasi total waktu (download + konversi + training + evaluasi)

| Tahap | Estimasi |
|---|---|
| Download dataset (clone/zip, 1.280 gambar) | 10–20 menit |
| Tulis & jalankan skrip konversi titik→bbox (fixed-size) | 30–60 menit |
| Setup ulang config YOLO11 (data.yaml, split train/val dari 720 train) | 15–30 menit |
| Fine-tuning YOLO11 (dataset kecil, beberapa puluh epoch) | 1–3 jam (tergantung GPU tersedia) |
| Evaluasi + bandingkan ke baseline pretrained | 30–60 menit |
| **Total** | **~3–6 jam** |

Ini **di luar batas 2 jam task verifikasi ini sendiri**, dan merupakan komitmen waktu tambahan yang cukup besar dibanding sekadar validasi pretrained.

## 5. Rekomendasi

Dataset **secara teknis feasible** — bisa diakses langsung, formatnya titik yang bisa dikonversi dengan skrip sederhana (bukan blocker berat), dan domainnya jauh lebih relevan ke TransJakarta/BRT dibanding ShanghaiTech.

Tapi trade-off waktunya nyata: total estimasi ~3–6 jam tambahan (belum termasuk risiko iterasi kalau hasil fine-tune pertama kurang bagus — box fixed-size dari titik itu approximate, bukan ground truth asli, jadi kualitas training terbatas oleh kualitas konversi).

**Keputusan disarankan:**
- Kalau sisa waktu kompetisi **masih longgar (>6–8 jam)** dan peningkatan akurasi di skenario mirip-BRT dianggap penting untuk skor — **worth dicoba**, mulai dari versi konversi fixed-size dulu (bukan yang adaptif, biar cepat).
- Kalau sisa waktu **terbatas/mepet** — **lebih aman fokus ke Task 01b–01d** (validasi & polish pipeline pretrained) dulu, karena itu sudah jalan dan risikonya jauh lebih rendah daripada bertaruh 3–6 jam ke fine-tuning dengan anotasi hasil konversi approximate.

Silakan konfirmasi sisa waktu kompetisi ke saya kalau mau saya bantu putuskan opsi mana yang diambil, atau langsung saya mulai bikin skrip konversi versi fixed-size kalau sudah diputuskan lanjut.
