# Task 02: Validasi Akurasi Deteksi — ShanghaiTech Part B

Melakukan sanity-check terhadap akurasi deteksi orang dari YOLO11 pretrained (yang sudah dibangun di Task 01) menggunakan dataset publik **ShanghaiTech Part B** yang memiliki ground truth berlabel.

## 🎯 Tujuan

- Membandingkan hasil deteksi YOLO11 dengan ground truth (kepala yang ter-annotasi) dari ShanghaiTech Part B
- Hitung error metrics: MAE, MAPE, RMSE
- Validasi confidence threshold awal dari Task 01
- **BUKAN pengganti** validasi video dari Task 01 (yang menguji tracking dan real-time behavior)

## ⚠️ Important Note

Task ini melakukan validasi **deteksi mentah per-gambar saja** (static images, no temporal data). **Tidak bisa memvalidasi:**
- Tracking accuracy (ByteTrack)
- Entered/exited counts
- Crowd status changes over time
- Real-time detection dari video

**Video validation dari Task 01 tetap WAJIB dituntaskan terpisah** untuk assessment lengkap!

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Dependencies:
- `scipy` — Untuk membaca format `.mat` ground truth
- `numpy`, `pandas` — Untuk calculation dan analysis

### 2. Download ShanghaiTech Part B (Manual)

Dataset ShanghaiTech tidak bisa diunduh otomatis (ToS). Anda perlu download manual:

**Option A: Via Kaggle**
```bash
# Install kaggle CLI
pip install kaggle

# Download (perlu setup kaggle API key)
kaggle datasets download -d tthien/shanghaitech

# Extract to ShanghaiTech/ folder di task ini
unzip shanghaitech.zip -d ShanghaiTech/
```

**Option B: Via GitHub (Dropbox mirror)**
1. Clone atau download dari: https://github.com/desenzhou/ShanghaiTechDataset
2. Extract ke folder `ShanghaiTech/` di dalam task ini

**Expected structure:**
```
task-02-validasi-shanghaitech/
├── ShanghaiTech/
│   └── part_B/
│       ├── test_data/
│       │   ├── images/
│       │   │   ├── IMG_1.jpg
│       │   │   ├── IMG_2.jpg
│       │   │   └── ... (716 images total)
│       │   └── ground-truth/
│       │       ├── IMG_1.mat
│       │       ├── IMG_2.mat
│       │       └── ... (716 .mat files)
│       └── ...
```

### 3. Run Validation

```bash
# Run validation pada 15 sample images (default)
python validate_shanghaitech.py

# Output akan tersimpan di results/ folder
```

**Output files:**
- `results/validation_results.csv` — Per-image results (CSV format)
- `results/validation_results.json` — Detailed results with metadata
- `results/validation_summary.txt` — Readable summary

## 📊 Output Format

### CSV Output (validation_results.csv)
```csv
image_name,predicted_count,actual_count,absolute_error,percentage_error
IMG_1.jpg,45,42,3,7.14%
IMG_2.jpg,38,40,2,5.00%
...
```

### JSON Output (validation_results.json)
```json
{
  "metadata": {
    "dataset": "ShanghaiTech Part B",
    "model": "yolo11n.pt",
    "confidence_threshold": 0.5,
    "sample_size": 15
  },
  "aggregate_metrics": {
    "MAE": 3.45,
    "MAPE": 8.23,
    "RMSE": 4.12,
    "predicted_mean": 42.3,
    "predicted_std": 15.6,
    "actual_mean": 40.2,
    "actual_std": 16.1,
    "total_samples": 15
  },
  "per_image_results": [
    {
      "image_name": "IMG_1.jpg",
      "predicted_count": 45,
      "actual_count": 42,
      "absolute_error": 3,
      "percentage_error": 7.14
    },
    ...
  ]
}
```

### Console Summary Output

```
======================================================================
SHANGHAITECH PART B - YOLO11 DETECTION VALIDATION SUMMARY
======================================================================

CONFIGURATION
  Model: yolo11n.pt
  Confidence Threshold: 0.5
  Samples Processed: 15

AGGREGATE ERROR METRICS
  MAE (Mean Absolute Error): 3.45 orang
  MAPE (Mean Absolute Percentage Error): 8.23%
  RMSE (Root Mean Squared Error): 4.12 orang

PREDICTION STATISTICS
  Predicted Count - Mean: 42.30
  Predicted Count - Std Dev: 15.60
  Actual Count - Mean: 40.20
  Actual Count - Std Dev: 16.10

SAMPLE RESULTS (First 10)
----------------------------------------------------------------------
1. IMG_1.jpg
   Predicted: 45, Actual: 42, Error: 3 (7.14%)
2. IMG_2.jpg
   Predicted: 38, Actual: 40, Error: 2 (5.00%)
...

======================================================================
IMPORTANT NOTES
======================================================================
✓ This validation tests DETECTION ACCURACY only (per-image, static).
✓ ShanghaiTech provides no temporal data — cannot validate tracking,
  entered/exited counts, or crowd_status changes over time.
✓ Video validation from Task 01 is STILL REQUIRED for full assessment.
✓ Results here are for confidence_threshold calibration only.
```

## ⚙️ Configuration

Edit `config.py` untuk customize:

```python
# Number of sample images to process (default: 15, recommended: 15-20)
SAMPLE_SIZE = 15

# Model & confidence threshold (reuse dari Task 01)
YOLO_MODEL = "yolo11n.pt"
PERSON_CLASS_ID = 0
CONFIDENCE_THRESHOLD = 0.5

# Output paths
RESULTS_DIR = Path("results")
```

## 🔍 Interpretasi Hasil

### MAE (Mean Absolute Error)
- **MAE = 3.5** berarti rata-rata error adalah 3-4 orang per gambar
- Semakin kecil semakin baik
- **Guidance:** <5 untuk skenario halte/stasiun dianggap acceptable

### MAPE (Mean Absolute Percentage Error)
- **MAPE = 8%** berarti rata-rata error ~8% dari actual count
- Semakin kecil semakin baik
- **Guidance:** <10% dianggap good, <15% acceptable

### RMSE (Root Mean Squared Error)
- **RMSE = 4.2** — lebih sensitif terhadap outlier error besar
- Semakin kecil semakin baik

## 🔄 Workflow & Next Steps

1. ✅ Task 01 sudah selesai (YOLO11 detection module built)
2. ⏳ **Task 02 (ini)** — Validasi akurasi dengan ShanghaiTech
   - Download dataset manual
   - Run validation script
   - Review metrics
3. 📹 **Task 01 (masih ongoing)** — Test dengan video nyata dari tim
   - Validate dengan video sample >30 detik
   - Adjust threshold jika diperlukan
   - Verify tracking accuracy
4. 🎯 **Final calibration** — Combine hasil Task 01 + Task 02

## 📋 Acceptance Criteria

- ✅ Script berjalan independen dari video Task 01
- ✅ Memakai model & confidence threshold dari Task 01
- ✅ Berhasil membaca format `.mat` ShanghaiTech
- ✅ Output menampilkan per-image comparison & agregat metrics (MAE/MAPE/RMSE)
- ✅ Hanya process ~15 sample images, bukan seluruh dataset
- ✅ Ada catatan jelas bahwa ini hanya untuk deteksi accuracy, bukan temporal behavior

## 🔗 Dependencies & Integration

- **Bergantung pada:** Task 01 (model & config)
- **Digunakan oleh:** Task 01 (confidence threshold calibration)
- **Dataset:** ShanghaiTech Part B (download manual)
- **Python version:** 3.10+

## ⚠️ Known Limitations

1. **Static images only** — ShanghaiTech adalah foto diam, tidak bisa validasi tracking
2. **Manual dataset download** — ToS tidak mengizinkan download otomatis
3. **Part B saja** — Part A (kepadatan ekstrem) tidak relevan dengan skenario halte
4. **In-memory processing** — Jika all 716 images diprocess, butuh >8GB RAM

## 📂 File Structure

```
task-02-validasi-shanghaitech/
├── config.py                    # Configuration (reuse dari Task 01)
├── validate_shanghaitech.py     # Main validation script
├── requirements.txt             # Dependencies (scipy, numpy, pandas)
├── README.md                    # Dokumentasi ini
├── ShanghaiTech/                # Dataset folder (manual download)
│   └── part_B/
│       ├── test_data/
│       │   ├── images/
│       │   └── ground-truth/
│       └── ...
└── results/                     # Output folder (auto-created)
    ├── validation_results.csv
    ├── validation_results.json
    └── validation_summary.txt
```

## 🤝 Catatan untuk Tim

- Task 02 adalah **complementary validation**, bukan pengganti video testing
- Hasil MAE/MAPE bisa dijadikan referensi awal untuk `confidence_threshold`
- Kalibrasi FINAL tetap menunggu hasil video nyata dari Task 01
- Jangan lakukan fine-tuning model sekalipun dataset tersedia — di luar scope

## 🚀 Troubleshooting

### "ShanghaiTech test images path not found"
→ Download dataset manual ke folder `ShanghaiTech/` (lihat Quick Start #2)

### "scipy is required but not installed"
→ Run: `pip install scipy`

### "Error reading .mat file"
→ Format `.mat` mungkin berbeda. Cek `image_info` key di `.mat` file
→ Alternative parsing akan attempt automatic

### Script berjalan lambat
→ Normal. YOLO11 inference per-image takes ~50-100ms on CPU

## 📖 References

- **ShanghaiTech Dataset:** https://github.com/desenzhou/ShanghaiTechDataset
- **Paper:** "Composition Loss for Counting, Density Map Estimation and Localization in Dense Crowds" (Li et al., 2018)
- **YOLO11:** https://github.com/ultralytics/ultralytics
- **SciPy:** https://docs.scipy.org/doc/scipy/reference/generated/scipy.io.loadmat.html

---

**Status:** 🟡 Ready for Testing (pending manual dataset download)  
**Last Updated:** 2026-08-27  
**Estimated Runtime:** ~10-15 minutes (15 sample images, CPU)
