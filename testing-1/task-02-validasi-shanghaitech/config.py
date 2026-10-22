"""
Configuration untuk Task 02: Validasi Akurasi ShanghaiTech
Pakai model & threshold yang sama dari Task 01
"""

import sys
from pathlib import Path

# Add Task 01 ke path supaya bisa import config-nya
task01_path = Path(__file__).parent.parent / "task-01-model0-mini"
if task01_path.exists():
    sys.path.insert(0, str(task01_path))

# Import model config dari Task 01
try:
    from config import (
        YOLO_MODEL,
        PERSON_CLASS_ID,
        CONFIDENCE_THRESHOLD,
    )
except ImportError:
    # Fallback jika Task 01 belum setup
    YOLO_MODEL = "yolo11n.pt"
    PERSON_CLASS_ID = 0
    CONFIDENCE_THRESHOLD = 0.5

# Task 02 Specific Configuration
SHANGHAITECH_VERSION = "part_B"  # Only Part B, not Part A
SAMPLE_SIZE = 15  # Number of sample images to process (recommended: 15-20)

# Expected ShanghaiTech directory structure
# Note: Dataset extract can create nested ShanghaiTech/ShanghaiTech/ or ShanghaiTech/ folder
if (Path("ShanghaiTech") / "ShanghaiTech" / "part_B" / "test_data" / "images").exists():
    SHANGHAITECH_BASE_PATH = Path("ShanghaiTech") / "ShanghaiTech"
elif (Path("ShanghaiTech") / "part_B" / "test_data" / "images").exists():
    SHANGHAITECH_BASE_PATH = Path("ShanghaiTech")
else:
    SHANGHAITECH_BASE_PATH = Path("ShanghaiTech") / "ShanghaiTech"

SHANGHAITECH_TEST_IMAGES_PATH = SHANGHAITECH_BASE_PATH / "part_B" / "test_data" / "images"
SHANGHAITECH_GROUND_TRUTH_PATH = SHANGHAITECH_BASE_PATH / "part_B" / "test_data" / "ground-truth"

# Output configuration
RESULTS_DIR = Path("results")
OUTPUT_CSV = RESULTS_DIR / "validation_results.csv"
OUTPUT_JSON = RESULTS_DIR / "validation_results.json"
OUTPUT_SUMMARY = RESULTS_DIR / "validation_summary.txt"

# Error metrics
CALCULATE_MAE = True  # Mean Absolute Error
CALCULATE_MAPE = True  # Mean Absolute Percentage Error
CALCULATE_RMSE = True  # Root Mean Squared Error

# Logging configuration
LOG_LEVEL = "INFO"
