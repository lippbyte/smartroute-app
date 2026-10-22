# Task 01b: Validasi dengan Video Nyata — Panduan Lengkap

Dokumentasi lengkap untuk merekam, process, dan validasi video nyata untuk menutup Task 01.

## 📹 Panduan Merekam Video

### Persyaratan Video

- **Durasi:** 30 detik - 2 menit (lebih pendek = lebih mudah untuk manual check)
- **Kepadatan:** 10-40 orang dalam frame (wajar untuk halte/stasiun, bukan ekstrem)
- **Sudut:** Agak dari atas/elevasi (mirip CCTV), bukan sejajar mata
- **Pencahayaan:** Cukup terang, hindari indoor gelap
- **Pergerakan:** Pastikan ada orang masuk/keluar frame (penting untuk testing tracking & entered/exited)
- **Format:** MP4, AVI, MOV, atau format video umum

### Lokasi Rekaman Ideal

✅ **Tempat yang cocok:**
- Terminal angkot / halte bus
- Stasiun / platform
- Jembatan penyeberangan
- Koridor mal saat sibuk
- Lobby kantor / sekolah
- Area outdoor dengan kepadatan wajar

❌ **Tempat yang kurang ideal:**
- Ruang sempit dengan pencahayaan gelap
- Kerumunan super padat (>100 orang, sudah tahu dari Task 02 akan gagal)
- Hanya orang diam tanpa pergerakan

### Izin & Privasi

- Rekam untuk keperluan riset/demo internal
- Jika wajah terlihat jelas, hindari publikasi luas tanpa izin
- Tidak perlu izin formal dari lokasi (cukup public area), tapi tanyakan jika ada security

---

## 🎬 Workflow Validasi

### Tahap 1: Persiapan (5-10 menit)

```bash
# 1. Buat folder untuk video
mkdir sample_videos/real_video_validation_[DATE]

# 2. Rekam video sesuai panduan di atas, simpan:
# sample_videos/real_video_validation_[DATE]/video.mp4

# 3. Tonton video 1x untuk memahami alurnya
```

### Tahap 2: Run Model Detection (5-15 menit)

```bash
# Jalankan dari folder task-01-model0-mini
cd task-01-model0-mini

# Process video
python test_video.py sample_videos/real_video_validation_[DATE]/video.mp4

# Output akan tersimpan di:
# - results/full_results.json (detail per-frame)
# - results/summary.json (agregat statistics)
```

### Tahap 3: Manual Validation (15-30 menit)

**Persiapan:**
1. Buka video dengan video player (VLC, Windows Media Player, dll)
2. Print atau copy template dari `manual_validation_template.md`
3. Siapkan notebook untuk catat pengamatan

**Langkah-langkah:**

#### 3a. Hitungan Manual di 3+ Waktu Berbeda

```
Pilih 3-5 waktu berbeda (misal: 5s, 15s, 25s, 35s, 45s)

Untuk setiap waktu:
1. Pause video di frame tersebut
2. Hitung jumlah orang terlihat dalam frame
3. Catat: [timestamp] = [manual count] orang

Contoh:
  00:00:05 → Manual count: 12 orang
  00:00:15 → Manual count: 15 orang
  00:00:25 → Manual count: 18 orang
```

#### 3b. Verifikasi Tracking (Track ID Consistency)

```
Pilih 2-3 individu yang terlihat cukup lama di video:

Untuk setiap individu:
1. Identifikasi visual (misal: "orang berkaos biru di kanan")
2. Note waktu kemunculan pertama dan terakhir
3. Cek di full_results.json:
   - Cari frame-frame di rentang waktu tersebut
   - Lihat apakah track_id mereka tetap sama
   - Catat apakah ada "jump" di track_id (indikasi masalah tracking)

Contoh tracking yang BAIK:
  Frame 50: track_id=5 → Person A
  Frame 51: track_id=5 → Person A
  Frame 52: track_id=5 → Person A
  ✓ Konsisten!

Contoh tracking yang JELEK:
  Frame 50: track_id=5 → Person A
  Frame 51: track_id=12 → Person A (sama orang, ID berubah!)
  Frame 52: track_id=5 → Person A (ID berubah lagi!)
  ✗ Tidak konsisten!
```

#### 3c. Verifikasi Entered/Exited

```
Manual count orang yang benar-benar masuk/keluar:

1. Pilih satu edge frame (misal: sisi kiri atau kanan)
2. Hitung dari awal video sampai akhir:
   - Berapa orang yang melewati edge tersebut? → ENTERED
   - Catatan: jangan double-count yang keluar lalu masuk lagi
3. Bandingkan dengan total ENTERED dari model:
   - Buka results/summary.json
   - Lihat "entered" field

Contoh:
  Video 30 detik:
  - Frame 1: Sudah ada 10 orang
  - Orang yang masuk selama video: ~5 orang
  - Model report entered: berapa?
  - Hitung error: |manual - model| / manual * 100%
```

### Tahap 4: Analisis & Kalibrasi (10-20 menit)

**4a. Bandingkan Manual vs Model Detection**

```
Untuk setiap timestamp yang di-check manual:

  Timestamp: 00:00:05
  Manual count: 12
  Model predicted: 14
  Error: 2 / 12 = 16.67%

Catat semua di tabel Excel atau Google Sheets:
  Timestamp | Manual | Model | Error | %Error
  00:00:05  | 12     | 14    | 2     | 16.67%
  00:00:15  | 15     | 16    | 1     | 6.67%
  00:00:25  | 18     | 17    | 1     | 5.56%
  ...

Hitung rata-rata error dan bandingkan dengan threshold yang diterima.
```

**4b. Evaluasi Tracking Accuracy**

```
Dari verifikasi tracking (3b):

  Total individu di-track: 3
  Individu dengan track_id konsisten: 3/3 ✓
  Accuracy: 100% (baik!)

Catat hasil di validation report.
```

**4c. Evaluasi Entered/Exited**

```
Dari verifikasi manual (3c):

  Manual entered: 5 orang
  Model entered: 6 orang
  Error: 20%

Catat di validation report.
```

**4d. Kalibrasi Threshold Kepadatan**

```
Berdasarkan pengamatan di video nyata:

Video kepadatan "sedang" = 10-20 orang
Video kepadatan "tinggi" = 20-35 orang

Update config.py:

CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": 10},    # <10 orang
    "sedang": {"min": 10, "max": 25},   # Adjust sesuai observasi
    "tinggi": {"min": 25, "max": float("inf")}  # Adjust
}

MAX_OCCUPANCY_CAPACITY = 100  # Adjust jika perlu
```

---

## ⏱️ Mengukur Waktu Proses

### Method 1: Built-in Script Timing

File `test_video.py` sudah include timing. Lihat di output:

```
Loading model: X.XX seconds
Processing video: Y.YY seconds
Total time: Z.ZZ seconds
```

### Method 2: Manual Timing dengan Command

**Windows:**
```powershell
$start = Get-Date
python test_video.py sample_videos/video.mp4
$end = Get-Date
($end - $start).TotalSeconds  # Print elapsed seconds
```

**Linux/Mac:**
```bash
time python test_video.py sample_videos/video.mp4
```

### Catat Hasil:

```
Video duration: 60 seconds
Video resolution: 1920x1080
Total processing time: 240 seconds (4 minutes)
Processing speed: 60 sec video / 240 sec processing = 0.25x real-time
=> Berarti model berjalan 4x lebih lambat dari video playback (normal untuk CPU)
```

---

## 📋 File-File Penting

### Sebelum Validasi:

1. **sample_videos/video_nyata.mp4** — Video yang akan di-test
2. **config.py** — Configuration (akan di-update setelah kalibrasi)
3. **results/** — Output folder (akan di-create saat run)

### Hasil Validasi:

1. **results/full_results.json** — Detail per-frame detection
2. **results/summary.json** — Aggregate statistics
3. **validation_report.md** — Report dari manual validation (Anda buat)

### Kalibrasi:

1. **config.py** — Update threshold berdasarkan hasil
2. **README.md** — Update dengan waktu proses aktual

---

## 🎯 Acceptance Criteria Checklist

- [ ] Video nyata direkam sesuai spesifikasi (30s-2min, 10-40 orang, ada pergerakan)
- [ ] `python test_video.py video_nyata.mp4` berjalan tanpa error
- [ ] Manual count di 3+ waktu berbeda dicatat dan dibandingkan dengan model
- [ ] Rata-rata error tercatat (target: <15% untuk kepadatan wajar)
- [ ] Minimal 2-3 individu di-track dengan track_id consistency diverifikasi
- [ ] Entered/exited diverifikasi, error tercatat
- [ ] Threshold kepadatan di config.py dikalibrasi berdasarkan hasil nyata
- [ ] Waktu proses aktual diukur dan dicatat di README (bukan estimasi)
- [ ] Validation report ditulis dan disimpan
- [ ] Status Task 01 acceptance criteria diperbarui sebagai SELESAI

---

## 📞 Troubleshooting

### Error: "Video not found"
→ Pastikan path ke video benar dan file ada

### Error: "Module not found: ultralytics"
→ Activate virtual environment: `venv\Scripts\Activate.ps1` (Windows) atau `source venv/bin/activate` (Linux)

### Model detection terlalu lambat
→ Normal untuk CPU. Estimated 0.1-0.2x real-time untuk YOLO11 Nano
→ Jika ingin lebih cepat: gunakan video dengan resolution lebih rendah, atau upgrade ke GPU

### Track ID berubah-ubah (tidak konsisten)
→ Ini adalah known issue dengan ByteTrack di kepadatan tinggi
→ Cek apakah kepadatan video sudah melebihi 40 orang (diluar spesifikasi)

### Entered/exited count sangat tidak masuk akal
→ Ini bisa karena orang masuk-keluar berulang kali di satu edge
→ Lihat detailed results di full_results.json untuk inspect per-frame

---

## 🔗 Related Files

- `test_video.py` — Main script untuk process video
- `detector.py` — YOLO11 detection module
- `config.py` — Configuration (akan di-update)
- `manual_validation_template.md` — Template untuk manual check
- `validation_report_template.md` — Template untuk final report

---

**Status:** 🟡 Ready to Execute (pending video recording)  
**Next Step:** Rekam video nyata sesuai panduan, lalu execute validation workflow
