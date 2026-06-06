@echo off
echo ===================================================
echo   CineCull Photo Culling Assistant
echo ===================================================

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    pause
    exit /b
)

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    pause
    exit /b
)

:: Get local IP address for LAN access
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set "LAN_IP=%%b"
    )
)

REM Create Python virtual environment if it doesn't exist
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

:: Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

:: Validate and update model URLs (runs every 24 hours)
echo Validating model download URLs...
python scripts\update_model_urls.py

:: Build frontend
echo Building frontend...
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
call npm run build
cd ..

:: Open dashboard in browser (local machine only)
echo.
echo Launching dashboard in your default browser...
start http://127.0.0.1:8000

:: Show access URLs
echo.
echo ===================================================
echo   Server is running!
echo ===================================================
echo.
echo   Local:   http://127.0.0.1:8000
echo   LAN:     http://%LAN_IP%:8000
echo.
echo   Share the LAN URL with other devices on your
echo   network to access CineCull remotely.
echo.
echo   Press Ctrl+C to stop the server.
echo ===================================================
echo.

:: Start FastAPI server on all interfaces for LAN access
echo Starting backend server...
uvicorn main:app --host 0.0.0.0 --port 8000
