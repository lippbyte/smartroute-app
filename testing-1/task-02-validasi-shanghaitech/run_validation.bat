@echo off
REM Script untuk menjalankan ShanghaiTech validation di Windows

echo.
echo ========================================
echo Task 02: ShanghaiTech Part B Validation
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

REM Check if ShanghaiTech dataset exists
if not exist "ShanghaiTech\part_B\test_data\images" (
    if not exist "ShanghaiTech\ShanghaiTech\part_B\test_data\images" (
        echo.
        echo WARNING: ShanghaiTech dataset not found!
        echo Please download ShanghaiTech Part B manually to: ShanghaiTech\ folder
        echo.
        echo Download options:
        echo   Option A: Kaggle - kaggle datasets download -d tthien/shanghaitech
        echo   Option B: GitHub - https://github.com/desenzhou/ShanghaiTechDataset
        echo.
        echo After downloading, extract to ShanghaiTech\ folder in this directory.
        echo.
        pause
        exit /b 1
    )
)

REM Run validation
echo.
echo ========================================
echo Running ShanghaiTech validation...
echo ========================================
echo.

python validate_shanghaitech.py

echo.
echo ========================================
echo Validation complete!
echo Check 'results/' folder for detailed outputs
echo ========================================
echo.

pause
