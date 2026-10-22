# How to Download ShanghaiTech Part B Dataset

ShanghaiTech dataset tidak bisa diunduh otomatis karena ToS. Ikuti panduan di bawah untuk download manual.

## Option A: Via Kaggle (Recommended)

### Prasyarat
- Akun Kaggle (gratis)
- Kaggle CLI installed

### Langkah-langkah

1. **Install Kaggle CLI**
   ```bash
   pip install kaggle
   ```

2. **Setup Kaggle API Key**
   - Login ke https://www.kaggle.com/
   - Buka Settings → API → Click "Create New API Token"
   - Ini akan download file `kaggle.json`
   - Move file ke `~/.kaggle/kaggle.json` (Linux/Mac) atau `C:\Users\<username>\.kaggle\kaggle.json` (Windows)
   - Set permission: `chmod 600 ~/.kaggle/kaggle.json` (Linux/Mac)

3. **Download Dataset**
   ```bash
   cd task-02-validasi-shanghaitech/
   kaggle datasets download -d tthien/shanghaitech
   ```

4. **Extract**
   ```bash
   unzip shanghaitech.zip -d .
   # Atau gunakan file manager
   ```

   Expected hasil:
   ```
   ShanghaiTech/
   ├── part_A/
   ├── part_B/
   │   ├── test_data/
   │   │   ├── images/ (716 images)
   │   │   ├── ground-truth/ (716 .mat files)
   │   │   └── ...
   │   ├── train_data/
   │   └── ...
   └── README.txt
   ```

---

## Option B: Via GitHub (Dropbox Mirror)

### Langkah-langkah

1. **Clone atau Download**
   - Go to: https://github.com/desenzhou/ShanghaiTechDataset
   - Click "Code" → Download ZIP

2. **Extract ke folder task**
   ```bash
   cd task-02-validasi-shanghaitech/
   
   # Windows: Extract ShanghaiTechDataset-master/ShanghaiTech/ ke ./ShanghaiTech/
   # Linux/Mac: Same
   ```

3. **Verify structure**
   ```bash
   ls -la ShanghaiTech/part_B/test_data/
   # Harus ada: images/ dan ground-truth/
   ```

---

## Option C: Via Baidu Drive (Slow but Direct)

Jika Option A & B tidak berhasil:
1. Visit: https://pan.baidu.com (require account)
2. Search: "ShanghaiTech" atau gunakan link dari GitHub repo
3. Download & extract

---

## Verify Installation

Setelah extract, verify struktur:

```bash
# Linux/Mac
ls -la ShanghaiTech/part_B/test_data/images/ | head -10
ls -la ShanghaiTech/part_B/test_data/ground-truth/ | head -10

# Windows PowerShell
Get-ChildItem ShanghaiTech/part_B/test_data/images/ | Select-Object -First 10
Get-ChildItem ShanghaiTech/part_B/test_data/ground-truth/ | Select-Object -First 10
```

Expected output:
- **images/** folder: 716 `.jpg` files (IMG_1.jpg, IMG_2.jpg, ..., IMG_716.jpg)
- **ground-truth/** folder: 716 `.mat` files (IMG_1.mat, IMG_2.mat, ..., IMG_716.mat)

---

## Run Validation

Setelah dataset terverifikasi, jalankan:

```bash
# Windows
run_validation.bat

# Linux/Mac
bash run_validation.sh
```

---

## Troubleshooting

### "Kaggle API not found"
```bash
pip install kaggle
# Setup API key sesuai panduan di atas
```

### "Dataset not found" error saat download
- Pastikan internet connection stabil
- Coba ulangi command download
- Atau gunakan Option B (GitHub mirror)

### "File permission denied" (Linux/Mac)
```bash
chmod +x run_validation.sh
bash run_validation.sh
```

### "Module not found" saat extract
- Verify path: `ShanghaiTech/part_B/test_data/`
- Pastikan folder structure benar (lihat Verify Installation)

### Disk space
ShanghaiTech Part B dataset size: ~125 MB
- Ensure minimal 500 MB free space untuk processing

---

## References

- **Kaggle Dataset:** https://www.kaggle.com/datasets/tthien/shanghaitech
- **GitHub Mirror:** https://github.com/desenzhou/ShanghaiTechDataset
- **Original Paper:** https://arxiv.org/abs/1611.08059

---

**Note:** Data ini adalah untuk keperluan penelitian & validasi saja. Jangan gunakan untuk tujuan komersial tanpa ijin.
