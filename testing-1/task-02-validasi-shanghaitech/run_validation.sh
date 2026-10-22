#!/bin/bash
# Script untuk menjalankan ShanghaiTech validation di Linux/Mac

echo ""
echo "========================================"
echo "Task 02: ShanghaiTech Part B Validation"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed"
    echo "Please install Python 3.10+ from python.org"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Check if ShanghaiTech dataset exists
if [ ! -d "ShanghaiTech/part_B/test_data/images" ] && [ ! -d "ShanghaiTech/ShanghaiTech/part_B/test_data/images" ]; then
    echo ""
    echo "WARNING: ShanghaiTech dataset not found!"
    echo "Please download ShanghaiTech Part B manually to: ShanghaiTech/ folder"
    echo ""
    echo "Download options:"
    echo "  Option A: Kaggle - kaggle datasets download -d tthien/shanghaitech"
    echo "  Option B: GitHub - https://github.com/desenzhou/ShanghaiTechDataset"
    echo ""
    echo "After downloading, extract to ShanghaiTech/ folder in this directory."
    echo ""
    exit 1
fi

# Run validation
echo ""
echo "========================================"
echo "Running ShanghaiTech validation..."
echo "========================================"
echo ""

python validate_shanghaitech.py

echo ""
echo "========================================"
echo "Validation complete!"
echo "Check 'results/' folder for detailed outputs"
echo "========================================"
echo ""
