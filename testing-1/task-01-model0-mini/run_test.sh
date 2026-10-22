#!/bin/bash
# Script untuk menjalankan test dengan video di Linux/Mac

echo ""
echo "========================================"
echo "SmartRoute AI - Model 0 Mini Test"
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

# Run test
echo ""
echo "========================================"
echo "Running detection test..."
echo "========================================"
echo ""

if [ $# -eq 0 ]; then
    echo "Running test with auto-generated dummy video..."
    python test_video.py
else
    echo "Running test with video: $1"
    python test_video.py "$1"
fi

echo ""
echo "========================================"
echo "Test completed!"
echo "Check 'results/' folder for output JSON files"
echo "========================================"
echo ""
