@echo off
setlocal enabledelayedexpansion

title DNS Shield - Launcher

echo ============================================================
echo        [DNS SHIELD] TUNNELING DETECTION PLATFORM
echo ============================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"

:: 1. Check Python Virtual Environment
if not exist "%PYTHON_EXE%" (
    echo [!] Python virtual environment not found in backend\venv.
    echo [*] Creating virtual environment...
    python -m venv "%BACKEND_DIR%\venv"
    if errorlevel 1 (
        echo [X] Error creating virtual environment. Please install Python 3.11+.
        pause
        exit /b 1
    )
    echo [*] Installing backend dependencies...
    "%PYTHON_EXE%" -m pip install --progress-bar off -r "%BACKEND_DIR%\requirements.txt"
)

:: 2. Check Frontend node_modules
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [*] Installing frontend dependencies (npm install)...
    cd /d "%FRONTEND_DIR%"
    call npm install
    cd /d "%ROOT_DIR%"
)

:: 3. Initialize Database
echo [*] Initializing SQLite database and settings...
set PYTHONIOENCODING=utf-8
"%PYTHON_EXE%" -m app.db.init_db

:: 4. Launch Backend Server
echo [*] Starting Backend API on http://127.0.0.1:8000...
start "DNS Shield - Backend (FastAPI)" cmd /k "cd /d ""%BACKEND_DIR%"" && set PYTHONIOENCODING=utf-8 && venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 5. Launch Frontend Server
echo [*] Starting Frontend UI on http://localhost:5173...
start "DNS Shield - Frontend (Vite)" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

:: 6. Wait briefly and open browser
ping 127.0.0.1 -n 4 >nul

echo [*] Opening application in default browser...
start http://localhost:5173

echo.
echo ============================================================
echo  [OK] DNS Shield is now running!
echo ============================================================
echo   * Web Application : http://localhost:5173
echo   * API Documentation : http://localhost:8000/docs
echo.
echo   Keep the two opened terminal windows running.
echo   To shut down, close those windows or run stop.bat.
echo ============================================================
echo.
pause
