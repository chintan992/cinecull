@echo off
echo ===================================================
echo Starting CineCull Photo Culling Assistant
echo ===================================================

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH. Please install Python.
    pause
    exit /b
)

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH. Please install Node.js.
    pause
    exit /b
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

:: Build frontend
echo Building frontend...
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
)
call npm run build
cd ..

:: Open dashboard in browser
echo Launching dashboard in your default browser...
start http://127.0.0.1:8000

:: Start FastAPI server
echo Starting backend server on http://127.0.0.1:8000
uvicorn main:app --host 127.0.0.1 --port 8000
