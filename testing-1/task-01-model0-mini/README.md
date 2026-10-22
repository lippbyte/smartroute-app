# Task 01: Model 0-Mini — Deteksi & Pelacakan Kepadatan (YOLO11)

Modul computer vision untuk deteksi dan menghitung jumlah orang dari video lokal, menggunakan YOLO11 pretrained dan ByteTrack tracking. Berdiri sendiri sebagai showcase AI untuk SmartRoute AI.

## 📋 Fitur

- **Deteksi orang real-time** dari video menggunakan YOLO11 pretrained (`yolo11n.pt`)
- **Tracking** dengan ByteTrack bawaan Ultralytics (persist track IDs)
- **Estimasi kepadatan** berdasarkan jumlah orang terdeteksi (rendah/sedang/tinggi)
- **Threshold configurable** untuk level kepadatan (dapat dikalibrasi tanpa edit kode)
- **REST API** dengan FastAPI untuk proses video dan ambil hasil
- **Output JSON** yang sesuai dengan schema kontrak yang ditentukan
- **Berjalan di CPU** tanpa memerlukan GPU khusus
- **Standalone test script** untuk testing tanpa server

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

**Dependencies yang diinstall:**
- `ultralytics` >= 8.0.0 — YOLO11 model dan tracking
- `fastapi` 0.104.1 — REST API framework
- `uvicorn` 0.24.0 — ASGI server
- `opencv-python` 4.8.1.78 — Video processing
- `numpy`, `pydantic`, `python-dotenv`

**Catatan:** Model YOLO11 (`yolo11n.pt`) akan diunduh otomatis saat pertama kali dijalankan (~50MB).

### 2. Jalankan Test dengan Video

**Option A: Test dengan dummy video (untuk quick test)**

```bash
python test_video.py
```

Ini akan:
1. Membuat dummy video automatik (2 detik, 15 FPS)
2. Menjalankan deteksi
3. Mencetak summary ke console
4. Menyimpan hasil ke `results/full_results.json` dan `results/summary.json`

**Option B: Test dengan video lokal Anda sendiri**

```bash
python test_video.py path/to/your/video.mp4
```

**Option C: Test dari Python REPL**

```python
from detector import DensityDetector
from pathlib import Path

detector = DensityDetector()
results = detector.process_video("path/to/video.mp4")
summary = detector.process_video_summary(results)

print(f"Frames: {summary['total_frames']}")
print(f"Avg people: {summary['average_person_count']}")
print(f"Dominant level: {summary['dominant_crowd_level']}")
```

### 3. Jalankan API Server

```bash
python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

Atau dengan wrapper:

```bash
python api.py
```

Server akan berjalan di: `http://localhost:8000`

**Interactive API docs:** `http://localhost:8000/docs`

### 4. Gunakan API Endpoints

#### Health Check

```bash
curl http://localhost:8000/health
```

#### Get Configuration

```bash
curl http://localhost:8000/config
```

#### Detect dari Video Upload

```bash
curl -X POST http://localhost:8000/detect \
  -F "file=@path/to/video.mp4" \
  -F "camera_id=MRT-BLOK-M-01"
```

#### Detect dari Video Lokal

```bash
curl "http://localhost:8000/detect/local?video_path=path/to/video.mp4"
```

#### Get Detection Summary

```bash
curl "http://localhost:8000/results/MRT-BLOK-M-01_video/summary"
```

#### Get Specific Frame Result

```bash
curl "http://localhost:8000/results/MRT-BLOK-M-01_video/frames?frame_id=100"
```

## 📊 Output Schema

Setiap frame detection menghasilkan JSON sesuai schema berikut:

```json
{
  "timestamp": "2026-08-22T07:35:21+07:00",
  "camera_id": "MRT-BLOK-M-01",
  "location": {
    "station": "Blok M BCA",
    "transport_mode": "MRT",
    "zone": "platform"
  },
  "frame": {
    "frame_id": 18452,
    "width": 1920,
    "height": 1080
  },
  "detections": [
    {
      "track_id": 101,
      "class": "person",
      "confidence": 0.97,
      "bounding_box": {
        "x": 421,
        "y": 238,
        "width": 86,
        "height": 201
      }
    }
  ],
  "passenger_count": {
    "current": 87,
    "entered": 12,
    "exited": 5
  },
  "crowd_status": {
    "level": "tinggi",
    "occupancy_percentage": 82
  }
}
```

## ⚙️ Konfigurasi

Edit file `config.py` untuk customize parameter:

### Crowd Density Thresholds

```python
CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": 10},    # 0-10 orang
    "sedang": {"min": 10, "max": 25},   # 10-25 orang
    "tinggi": {"min": 25, "max": float("inf")}  # 25+ orang
}
```

Ubah nilai `max` sesuai dengan kalibrasi aktual setelah testing dengan video demo asli.

### Occupancy Capacity

```python
MAX_OCCUPANCY_CAPACITY = 100  # Jumlah orang maksimal untuk occupancy 100%
```

Kalau area platform standar MRT Anda lebih besar/kecil, sesuaikan nilai ini.

### Detection Confidence

```python
CONFIDENCE_THRESHOLD = 0.5  # Min confidence (0.0 - 1.0)
```

Naik nilai untuk lebih strict, turun untuk lebih sensitif.

### Frame Processing

```python
PROCESS_EVERY_N_FRAMES = 1  # Process setiap frame (set ke 2+ untuk lebih cepat)
INCLUDE_DETECTION_DETAILS = True  # Include bounding boxes dalam output
```

## 📈 Performance Notes

**Waktu processing (estimasi CPU Intel i5 gen 8+):**
- YOLO11 Nano: ~50-100ms per frame (480p video)
- Dengan tracking: +10-20ms per frame
- Total 1 menit video (~1800 frames): 2-4 menit processing time (CPU)

**Memory usage:**
- Model YOLO11 Nano: ~200MB RAM
- Per-frame processing: ~50MB RAM
- Total: ~250-500MB RAM

**Optimasi untuk lebih cepat:**
- Set `PROCESS_EVERY_N_FRAMES = 2` atau lebih (skip frames)
- Kurangi video resolution input
- Pakai GPU jika tersedia (ubah device="cuda" di detector init)

## 🔄 Workflow Development

### 1. Setup awal (sudah selesai)
- ✅ Struktur folder dan dependencies
- ✅ Modul deteksi YOLO11 + tracking
- ✅ REST API dengan FastAPI
- ✅ Test script standalone
- ✅ Config yang bisa dikustomisasi

### 2. Testing fase 1 (TODO - selanjutnya)
- [ ] Jalankan test dengan video sample dari tim (>30 detik)
- [ ] Validasi jumlah orang terdeteksi (bandingkan dengan hitungan manual)
- [ ] Catat waktu processing aktual
- [ ] Adjust threshold kepadatan berdasarkan hasil

### 3. Integrasi fase 2 (TODO - belakangan)
- [ ] Endpoint `/stream` untuk hasil real-time per frame (opsional, P1 jika ada waktu)
- [ ] Export video dengan bounding boxes visualization (opsional)
- [ ] Simpan results ke database (sekarang in-memory cache)

### 4. QA & Demo (TODO)
- [ ] Test dengan minimal 3 video sample dari stasiun berbeda
- [ ] Buat demo script untuk hari-H pitch
- [ ] Dokumentasi live demo (panduan step-by-step)

## 📂 File Structure

```
task-01-model0-mini/
├── requirements.txt          # Python dependencies
├── config.py                 # Konfigurasi threshold & parameter
├── detector.py               # Modul deteksi YOLO11 + tracking
├── api.py                    # FastAPI application
├── test_video.py             # Test script standalone
├── README.md                 # Dokumentasi ini
├── sample_videos/            # Folder untuk video sample
│   └── (video files di sini)
└── results/                  # Output folder (auto-created)
    ├── full_results.json     # Detail per-frame results
    └── summary.json          # Summary statistics
```

## ⚠️ Known Limitations & TODOs

1. **In-memory cache** — Results hanya disimpan di RAM, hilang saat server restart. Di production, gunakan database.

2. **Simplified entered/exited** — Hanya hitung track IDs baru vs hilang. Untuk menghitung orang actual masuk/keluar, perlu detect "crossing lines" di video (P1 jika ada waktu).

3. **Video upload size limit** — Default FastAPI ~100MB. Untuk video lebih besar, ubah `max_upload_size` di uvicorn config.

4. **No real-time streaming yet** — Endpoint `/stream` opsional P1. Sekarang hanya support full video processing.

5. **Static metadata** — Camera ID & location dari config atau query param. Belum ada learning dari metadata video file.

## 🔗 Referensi & Dependencies

- **YOLO11** — Ultralytics: https://github.com/ultralytics/ultralytics
- **ByteTrack** — Built-in di Ultralytics, paper: https://arxiv.org/abs/2110.06864
- **FastAPI** — https://fastapi.tiangolo.com/
- **OpenCV** — https://opencv.org/

## 📝 Acceptance Criteria (Task 01)

- [x] Instalasi berjalan tanpa error dari `requirements.txt`
- [x] Model berhasil load `yolo11n.pt` (otomatis saat pertama kali)
- [x] Endpoint API menerima video dan mengembalikan output sesuai schema JSON
- [ ] Jumlah orang terdeteksi masuk akal visual (TODO: testing dengan video real)
- [ ] Level kepadatan berubah sesuai threshold configurable
- [x] Berjalan di CPU biasa (tanpa GPU khusus)
- [x] README singkat dengan cara install, jalankan, dan ganti threshold

## 🤝 Catatan untuk Tim SmartRoute AI

- Modul ini **berdiri sendiri** — tidak terhubung ke pipeline scoring/routing aplikasi utama
- Data kepadatan untuk aplikasi utama **tetap dari laporan pengguna** (tombol penuh/sedang/lengang)
- YOLO11 showcase hanya untuk **PoC AI** di pitch, bukan critical path aplikasi
- Output JSON harus **persis sesuai schema** untuk kompatibilitas dengan frontend/dashboard nantinya

---

**Status:** ✅ MVP Ready for Testing
**Last Updated:** 2026-08-27
**Estimated Processing Time (1 min video, CPU):** 2-4 menit
