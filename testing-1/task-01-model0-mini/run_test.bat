@echo off
REM Script untuk menjalankan test dengan video di Windows

echo.
echo ========================================
echo SmartRoute AI - Model 0 Mini Test
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10+ from python.org
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo.
echo Installing dependencies...
pip install -q -r requirements.txt

REM Run test
echo.
echo ========================================
echo Running detection test...
echo ========================================
echo.

if "%1"=="" (
    echo Running test with auto-generated dummy video...
    python test_video.py
) else (
    echo Running test with video: %1
    python test_video.py "%1"
)

echo.
echo ========================================
echo Test completed!
echo Check 'results/' folder for output JSON files
echo ========================================
echo.

pause
