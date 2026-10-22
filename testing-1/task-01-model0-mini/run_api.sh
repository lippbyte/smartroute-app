#!/bin/bash
# Script untuk menjalankan API server di Linux/Mac

echo ""
echo "========================================"
echo "SmartRoute AI - Model 0 Mini YOLO11 API"
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

# Run API
echo ""
echo "========================================"
echo "Starting API Server..."
echo "========================================"
echo ""
echo "API Documentation: http://localhost:8000/docs"
echo "Health Check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
