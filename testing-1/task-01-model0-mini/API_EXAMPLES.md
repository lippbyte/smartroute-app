# API Request Examples

Dokumentasi lengkap request/response untuk REST API Task 01.

## Setup API Server

```bash
# Windows
run_api.bat

# Linux/Mac
bash run_api.sh
```

API akan berjalan di `http://localhost:8000`

## 1. Health Check

**Request:**
```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "SmartRoute AI - Model 0 Mini",
  "version": "1.0.0"
}
```

---

## 2. Get Configuration

**Request:**
```bash
curl http://localhost:8000/config
```

**Response:**
```json
{
  "crowd_density_thresholds": {
    "rendah": {
      "min": 0,
      "max": 10
    },
    "sedang": {
      "min": 10,
      "max": 25
    },
    "tinggi": {
      "min": 25,
      "max": Infinity
    }
  },
  "max_occupancy_capacity": 100,
  "default_camera_id": "MRT-BLOK-M-01",
  "default_location": {
    "station": "Blok M BCA",
    "transport_mode": "MRT",
    "zone": "platform"
  }
}
```

---

## 3. Detect from Uploaded Video

**Request:**
```bash
curl -X POST http://localhost:8000/detect \
  -F "file=@sample_videos/test_video.mp4" \
  -F "camera_id=MRT-BLOK-M-01" \
  -F "location_station=Blok M BCA" \
  -F "location_mode=MRT" \
  -F "location_zone=platform"
```

**Response (array of frame results):**
```json
[
  {
    "timestamp": "2026-08-27T10:30:45.123456+00:00",
    "camera_id": "MRT-BLOK-M-01",
    "location": {
      "station": "Blok M BCA",
      "transport_mode": "MRT",
      "zone": "platform"
    },
    "frame": {
      "frame_id": 0,
      "width": 1920,
      "height": 1080
    },
    "detections": [
      {
        "track_id": 1,
        "class": "person",
        "confidence": 0.95,
        "bounding_box": {
          "x": 100,
          "y": 200,
          "width": 80,
          "height": 150
        }
      }
    ],
    "passenger_count": {
      "current": 5,
      "entered": 2,
      "exited": 1
    },
    "crowd_status": {
      "level": "rendah",
      "occupancy_percentage": 5
    }
  },
  ...more frames...
]
```

**Note:** 
- Request dapat menggunakan `multipart/form-data` untuk upload file
- Query parameters `camera_id`, `location_*` adalah optional, akan menggunakan default jika tidak diberikan
- Response adalah array berisi hasil detection setiap frame

---

## 4. Detect from Local Video File

**Request:**
```bash
# Absolute path
curl "http://localhost:8000/detect/local?video_path=/path/to/video.mp4&camera_id=MRT-BLOK-M-01"

# Relative path (from task-01-model0-mini/)
curl "http://localhost:8000/detect/local?video_path=sample_videos/test.mp4"
```

**Query Parameters:**
- `video_path` (required): Path ke file video (absolute atau relative)
- `camera_id` (optional): ID kamera
- `location_station` (optional): Nama stasiun
- `location_mode` (optional): Mode transportasi
- `location_zone` (optional): Zona lokasi

**Response:** Same as endpoint #3 (array of frame results)

---

## 5. Get Detection Summary

**Request:**
```bash
# Assuming result_id = "MRT-BLOK-M-01_test_video"
curl "http://localhost:8000/results/MRT-BLOK-M-01_test_video/summary"
```

**Response:**
```json
{
  "total_frames": 240,
  "average_person_count": 12.5,
  "max_person_count": 35,
  "min_person_count": 2,
  "dominant_crowd_level": "sedang",
  "level_distribution": {
    "rendah": 80,
    "sedang": 120,
    "tinggi": 40
  }
}
```

**Note:**
- `result_id` dibentuk dari: `{camera_id}_{video_filename_tanpa_extension}`
- Lihat endpoint #8 untuk list semua available result IDs

---

## 6. Get Specific Frame Result

**Request:**
```bash
# Get specific frame by ID
curl "http://localhost:8000/results/MRT-BLOK-M-01_test_video/frames?frame_id=100"

# Get first 10 frames
curl "http://localhost:8000/results/MRT-BLOK-M-01_test_video/frames?limit=10"

# Get all frames (default)
curl "http://localhost:8000/results/MRT-BLOK-M-01_test_video/frames"
```

**Query Parameters:**
- `frame_id` (optional): Get specific frame
- `limit` (optional): Limit jumlah frames yang di-return

**Response (single frame):**
```json
{
  "timestamp": "2026-08-27T10:30:45.123456+00:00",
  "camera_id": "MRT-BLOK-M-01",
  "location": {...},
  "frame": {
    "frame_id": 100,
    "width": 1920,
    "height": 1080
  },
  "detections": [...],
  "passenger_count": {...},
  "crowd_status": {
    "level": "sedang",
    "occupancy_percentage": 25
  }
}
```

---

## 7. List All Cached Results

**Request:**
```bash
curl http://localhost:8000/results
```

**Response:**
```json
{
  "cached_results": [
    "MRT-BLOK-M-01_test_video",
    "MRT-BLOK-M-01_another_video"
  ],
  "total_cached": 2
}
```

---

## 8. Delete Cached Result

**Request:**
```bash
curl -X DELETE "http://localhost:8000/results/MRT-BLOK-M-01_test_video"
```

**Response:**
```json
{
  "message": "Result MRT-BLOK-M-01_test_video deleted successfully"
}
```

---

## Complete Workflow Example

### 1. Start API server
```bash
run_api.bat  # Windows
# atau
bash run_api.sh  # Linux/Mac
```

### 2. Check health
```bash
curl http://localhost:8000/health
```

### 3. Get config
```bash
curl http://localhost:8000/config
```

### 4. Upload video for detection
```bash
curl -X POST http://localhost:8000/detect \
  -F "file=@sample_videos/test_video.mp4" \
  -F "camera_id=MRT-BLOK-M-01"
```

### 5. Get summary statistics
```bash
# Result ID dari step 4 di atas
curl "http://localhost:8000/results/MRT-BLOK-M-01_test_video/summary"
```

### 6. Get specific frame
```bash
curl "http://localhost:8000/results/MRT-BLOK-M-01_test_video/frames?frame_id=50"
```

### 7. List all cached results
```bash
curl http://localhost:8000/results
```

### 8. Delete result
```bash
curl -X DELETE "http://localhost:8000/results/MRT-BLOK-M-01_test_video"
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "File type '.txt' not supported. Allowed: {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'}"
}
```

### 404 Not Found
```json
{
  "detail": "Result ID not found: invalid_id"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Error description here"
}
```

---

## Testing dengan Python Requests Library

```python
import requests
import json

BASE_URL = "http://localhost:8000"

# 1. Health check
response = requests.get(f"{BASE_URL}/health")
print(response.json())

# 2. Upload video
with open("sample_videos/test_video.mp4", "rb") as f:
    files = {"file": f}
    data = {"camera_id": "MRT-BLOK-M-01"}
    response = requests.post(f"{BASE_URL}/detect", files=files, data=data)
    results = response.json()
    print(f"Frames detected: {len(results)}")

# 3. Get summary
result_id = "MRT-BLOK-M-01_test_video"
response = requests.get(f"{BASE_URL}/results/{result_id}/summary")
summary = response.json()
print(f"Average people: {summary['average_person_count']}")
print(f"Dominant level: {summary['dominant_crowd_level']}")

# 4. Get specific frame
response = requests.get(f"{BASE_URL}/results/{result_id}/frames?frame_id=50")
frame = response.json()
print(f"Frame {frame['frame']['frame_id']}: {frame['passenger_count']['current']} people")
```

---

## Testing dengan Postman

1. Import requests dari file ini
2. Set variable `base_url = http://localhost:8000`
3. Atau copy-paste individual cURL commands ke Postman

---

## API Documentation (Auto-generated)

Kunjungi `http://localhost:8000/docs` untuk interactive Swagger UI documentation
