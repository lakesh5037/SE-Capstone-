@echo off
echo ============================================================
echo  HemoScan AI Engine - One-Time Setup
echo ============================================================
echo.
echo Checking Python...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10+ from python.org
    pause
    exit /b 1
)

echo.
echo Installing AI inference dependencies...
pip install ai-edge-litert numpy Pillow

echo.
echo ============================================================
echo  Setup complete! Your XAMPP server now supports AI inference.
echo  No background process needed - PHP calls Python on demand.
echo ============================================================
pause
