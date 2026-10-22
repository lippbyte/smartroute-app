# Laporan Task Model0-03: Validasi Video + Visual Output (Pretrained, Tanpa Fine-Tuning)

**Status:** Selesai. Tidak ada training/fine-tuning yang dijalankan — pretrained `yolo11n.pt` + `bytetrack.yaml` apa adanya, sesuai batasan task.

## Apa yang dikerjakan

Task 01c sebelumnya sudah punya opsi `save_visual` (pakai `save=True` bawaan Ultralytics), tapi itu belum menampilkan **counter jumlah orang** yang diminta task ini. Jadi dibuat script baru [generate_demo_videos.py](task-01-model0-mini/generate_demo_videos.py) yang menggambar overlay secara manual per frame (OpenCV) di atas hasil `model.track()`:

- Bounding box hijau per orang terdeteksi.
- Label `ID <track_id>` di atas box (konsisten selama orang itu masih di-track).
- Counter `Orang saat ini: N` di pojok kiri atas, update tiap frame.
- Output ditulis sebagai **`.mp4` asli** (codec `mp4v`), bukan `.avi` seperti default Ultralytics.
- Video sumber 4K didownscale ke lebar maks 1280px untuk output (kecepatan proses + ukuran file demo, kualitas visual tidak terpengaruh).

Script ini juga menghitung statistik tracking otomatis per video (bukan sekadar "berhasil/gagal"):
- `id_turnover_ratio` = total ID unik ÷ rata-rata orang per frame → makin tinggi, makin sering ID "berganti" untuk jumlah orang yang sama (indikasi ID switching).
- `flicker_ratio` = proporsi track yang hidup <10 frame lalu hilang → indikasi deteksi putus-nyambung.
- `avg_track_lifetime_sec` = rata-rata durasi 1 ID bertahan.
- `big_count_jump_rate` = seberapa sering count berubah drastis (≥3 orang) antar-frame → indikasi deteksi hilang-muncul mendadak (occlusion parah).

## Catatan penting: jumlah video

Task menyebut "10 sample video sudah tersedia". Yang ditemukan di `task-01-model0-mini/sample_videos/` ada **11 file** (10 stok/footage generik + 1 video HP asli dari Task 01c). Semua 11 diproses — tidak ada yang dilewati.

## Hasil per video

| Video | Durasi | Avg orang/frame | Turnover ratio | Flicker ratio | Jump rate | Catatan konkret |
|---|---|---|---|---|---|---|
| `12752510_3840_2160_60fps` (platform kereta, jarak sedang) | 14.6s | 7.8 (max 12) | **9.4** | 0.37 | 0.008 | ID paling stabil di antara video padat-sedang — box menempel rapat ke tiap orang, hampir tidak ada jump. **Kandidat demo #1.** |
| `12492823_960_540_30fps` (eskalator stasiun) | 17.9s | 10.9 (max 16) | **7.2** (terbaik ke-2) | 0.32 | 0.009 | Lifetime rata-rata ID terpanjang (2.5s) di kepadatan cukup tinggi. Box akurat walau orang membelakangi kamera. **Kandidat demo #2.** |
| `10287402-sd_540_960_30fps` (peron subway + kereta) | 43.3s | 6.2 (max 14) | 15.4 | 0.26 | 0.005 | Deteksi bagus di orang dekat kamera, tapi ID lebih sering ganti dibanding 2 kandidat di atas — video terpanjang jadi exposure ke ID switching lebih besar. |
| `13827811_3840_2160_30fps` | 20.6s | 11.8 (max 16) | 13.0 | 0.27 | 0.021 | Kepadatan cukup tinggi, box masih menempel wajar, tapi jump rate mulai naik — konsisten dengan prediksi "ID mulai lompat saat orang berdekatan". |
| `12843532_1280_720_30fps` (prosesi/kerumunan padat, jarak dekat) | 4.4s | 11.8 (max 15) | 3.5 (terendah, tapi video sangat pendek) | 0.29 | **0.061 (tertinggi)** | Kerumunan padat & saling menutupi (occlusion tinggi) → box sering "loncat" antar orang tiap beberapa frame. Video juga terlalu pendek untuk demo yang meyakinkan. |
| `11724798-uhd_3840_2160_30fps` | 39.2s | 6.4 (max 11) | 25.2 | 0.48 | 0.005 | ID cukup sering berganti walau orang tidak terlalu banyak — kemungkinan karena resolusi asli sangat tinggi (4K) membuat orang jauh jadi kecil & gampang hilang-nongol lagi dengan ID baru. |
| `8c6818ad1aa7e04c` | 14.1s | 5.1 (max 11) | 13.3 | 0.35 | 0.014 | Performa medium, tidak ada yang menonjol positif/negatif. |
| `VID_20260827_105315` (video HP asli, peron sepi) | 23.8s | 2.1 (max 6) | 29.7 | 0.43 | 0.000 | Orang sedikit (1-2 di frame) tapi ID tetap sering berganti — kemungkinan re-deteksi tiap orang keluar-masuk frame kamera HP yang bergerak. |
| `IMG_2546` (kerumunan acara outdoor, padat & jauh) | 24.2s | 5.2 (max 10) | 45.7 (tinggi) | 0.39 | 0.011 | **Under-detection jelas terlihat**: visual menunjukkan puluhan orang di background tapi model cuma menangkap ~5 yang dekat kamera — konsisten dengan temuan sanity check ShanghaiTech soal keterbatasan pretrained di crowd padat/jauh. |
| `19085074-uhd_2160_3840_60fps` (peron kereta sangat padat, format portrait) | 8.0s | **1.6 (sangat rendah)** | 9.5 | 0.53 | 0.002 | Scene sebenarnya sangat ramai (puluhan orang terlihat), tapi model cuma mendeteksi 1-2 orang terdekat per frame — **under-detection paling parah** di dataset ini, sesuai prediksi. |
| `5bdbb24e753306fc180cf00c699773ae` (drone/aerial, penyeberangan jalan) | 16.0s | **0.4 (nyaris nol)** | 56.5 (tertinggi) | **0.88 (nyaris semua track "flicker")** | 0.005 | **Gagal total**: sudut pandang drone/aerial membuat orang jadi sangat kecil di frame — pada satu sampel frame ada puluhan pejalan kaki terlihat jelas tapi counter menunjukkan "0". Sesuai batasan task, ini tidak dicoba diperbaiki — dicatat sebagai limitasi jelas pretrained model untuk sudut pandang aerial. |

## Rekomendasi kandidat demo (1-2 video terbaik)

**Kandidat #1 — `12752510_3840_2160_60fps` (peron kereta/rel, jarak kamera sedang)**
Paling stabil untuk skenario kepadatan sedang (7-12 orang), box akurat, ID nggak gampang lompat, dan scene-nya (platform + rel kereta) paling representatif untuk konteks transportasi publik dibanding video lain.

**Kandidat #2 — `12492823_960_540_30fps` (eskalator stasiun)**
Kepadatan lebih tinggi (10-16 orang) dengan stabilitas ID terbaik kedua dan durasi ID rata-rata terpanjang — bagus untuk menunjukkan tracking tetap konsisten walau orang cukup ramai dan sering membelakangi kamera.

Kedua file sudah disalin ke folder final, siap dipresentasikan langsung tanpa proses tambahan:

```
task-01-model0-mini/results/demo_videos/BEST_DEMO/
├── 01_BEST_12752510_platform_kereta.mp4
└── 02_BEST_12492823_eskalator_stasiun.mp4
```

Semua 11 video hasil overlay (bukan cuma yang terbaik) tetap tersimpan di `task-01-model0-mini/results/demo_videos/` kalau sewaktu-waktu dibutuhkan sebagai pembanding.

## Temuan tambahan (di luar acceptance criteria, tapi relevan)

- **Limitasi pretrained paling jelas: crowd padat & jarak jauh/aerial.** Tiga video terburuk (`5bdbb24e`, `19085074`, `IMG_2546`) semuanya kasus di mana orang tampak kecil di frame (drone tinggi, sudut kamera jauh, atau resolusi terlalu di-downscale relatif ke jumlah orang). Ini konsisten dan memperkuat temuan sanity check ShanghaiTech sebelumnya — bukan temuan baru, tapi sekarang ada bukti video konkret.
- **Catatan teknis kecil (kosmetik, tidak mempengaruhi hasil):** karena satu instance model dipakai bergantian untuk 11 video dalam satu proses batch, penomoran `track_id` terus naik lintas video (mis. video ke-5 mulai dari ID ~700-an, bukan dari 1). Ini tidak memengaruhi validitas analisis stabilitas per video (setiap video dihitung terpisah), hanya membuat angka ID di video terlihat besar — tidak masalah untuk demo karena yang penting ID-nya konsisten selama orang itu di frame, bukan nilai absolutnya.

## Lokasi file

- Script: [task-01-model0-mini/generate_demo_videos.py](task-01-model0-mini/generate_demo_videos.py)
- Semua video hasil overlay: `task-01-model0-mini/results/demo_videos/*.mp4`
- Statistik lengkap (JSON): `task-01-model0-mini/results/demo_videos/_stats_summary.json`
- **Video demo terbaik (siap presentasi):** `task-01-model0-mini/results/demo_videos/BEST_DEMO/`
