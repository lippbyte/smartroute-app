"""
Configuration untuk modul deteksi kepadatan YOLO11
Dapat dikustomisasi tanpa mengubah kode deteksi
"""

# Model configuration
YOLO_MODEL = "yolo11n.pt"  # Ultralytics YOLO11 nano model
TRACKER_CONFIG = "bytetrack.yaml"  # Built-in ByteTrack tracker

# Detection parameters
PERSON_CLASS_ID = 0  # COCO dataset: person = class 0
CONFIDENCE_THRESHOLD = 0.35  # Min confidence untuk detection (optimized for track stability)

# Crowd density thresholds (dapat dikalibrasi setelah testing)
CROWD_DENSITY_THRESHOLDS = {
    "rendah": {"min": 0, "max": 10},  # 0-10 orang
    "sedang": {"min": 10, "max": 25},  # 10-25 orang
    "tinggi": {"min": 25, "max": float("inf")}  # 25+ orang
}

# Occupancy percentage thresholds (berdasarkan kapasitas area)
# Asumsi: area standar platform MRT/stasiun: ~200 m²
# Kapasitas ideal ~2 orang/m² = 400 orang max
MAX_OCCUPANCY_CAPACITY = 100  # Jumlah orang maksimal untuk occupancy 100%

# Video processing
PROCESS_EVERY_N_FRAMES = 1  # Process setiap frame (set ke 2+ untuk lebih cepat)
FRAME_RATE_LIMIT = None  # Tidak ada limit frame rate (None = process semua)

# Output configuration
INCLUDE_DETECTION_DETAILS = True  # Include bounding boxes dalam output
TRACK_PERSISTENCE = True  # Persist track IDs across frames

# Camera/Location metadata (untuk demo)
DEFAULT_CAMERA_ID = "MRT-BLOK-M-01"
DEFAULT_LOCATION = {
    "station": "Blok M BCA",
    "transport_mode": "MRT",
    "zone": "platform"
}

# API configuration
API_HOST = "0.0.0.0"
API_PORT = 8000
API_RELOAD = True  # Auto-reload saat development
