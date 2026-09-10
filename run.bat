@echo off
setlocal enabledelayedexpansion

title DNS Shield - Launcher

echo ========================================================================
echo               DNS SHIELD - TUNNELING DETECTION PLATFORM
echo ========================================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"

:: -------------------------------------------------------------------------
:: 1. Clear any lingering processes on ports 8000 & 5173
:: -------------------------------------------------------------------------
echo [*] Checking and freeing ports 8000 and 5173...
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr ":8000"') do (
    taskkill /F /PID %%p >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr ":5173"') do (
    taskkill /F /PID %%p >nul 2>&1
)

:: -------------------------------------------------------------------------
:: 2. Check or Create Python Virtual Environment
:: -------------------------------------------------------------------------
if not exist "%PYTHON_EXE%" (
    echo [!] Python virtual environment not found in backend\venv.
    echo [*] Creating virtual environment...
    python -m venv "%BACKEND_DIR%\venv"
    if errorlevel 1 (
        echo [X] Error creating virtual environment. Please ensure Python 3.10+ is installed and on your PATH.
        echo.
        pause
        exit /b 1
    )
    echo [*] Installing backend dependencies (this may take a couple minutes)...
    "%PYTHON_EXE%" -m pip install --upgrade pip >nul 2>&1
    "%PYTHON_EXE%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    if errorlevel 1 (
        echo [X] Error installing backend requirements.
        pause
        exit /b 1
    )
)

:: -------------------------------------------------------------------------
:: 3. Check Frontend Dependencies
:: -------------------------------------------------------------------------
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [*] Installing frontend dependencies (npm install)...
    cd /d "%FRONTEND_DIR%"
    call npm install
    cd /d "%ROOT_DIR%"
)

:: -------------------------------------------------------------------------
:: 4. Initialize Database
:: -------------------------------------------------------------------------
echo [*] Initializing SQLite database and default settings...
cd /d "%BACKEND_DIR%"
set PYTHONIOENCODING=utf-8
set PYTHONPATH=%BACKEND_DIR%
"%PYTHON_EXE%" -m app.db.init_db >nul 2>&1
cd /d "%ROOT_DIR%"

:: -------------------------------------------------------------------------
:: 5. Start Backend Server (FastAPI on port 8000)
:: -------------------------------------------------------------------------
echo [*] Launching Backend API on http://127.0.0.1:8000...
start "DNS Shield - Backend (FastAPI)" cmd /k "cd /d ""%BACKEND_DIR%"" && set PYTHONIOENCODING=utf-8 && set PYTHONPATH=%BACKEND_DIR% && ""%PYTHON_EXE%"" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: -------------------------------------------------------------------------
:: 6. Start Frontend Server (Vite on port 5173)
:: -------------------------------------------------------------------------
echo [*] Launching Frontend UI on http://localhost:5173...
start "DNS Shield - Frontend (Vite)" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

:: -------------------------------------------------------------------------
:: 7. Wait briefly and open browser
:: -------------------------------------------------------------------------
echo [*] Waiting for services to become ready...
ping 127.0.0.1 -n 4 >nul

echo [*] Opening application in your default browser...
start http://localhost:5173

echo.
echo ========================================================================
echo                 DNS SHIELD IS NOW ACTIVE AND RUNNING!
echo ========================================================================
echo   * Web Application UI   : http://localhost:5173
echo   * Backend API Swagger  : http://localhost:8000/docs
echo   * API Health Check     : http://localhost:8000/api/health
echo ========================================================================
echo.
echo   NOTE: Two service terminal windows have been opened in the background.
echo.
echo   >> PRESS ANY KEY TO STOP ALL SERVICES AND EXIT <<
echo ========================================================================
pause >nul

echo.
echo [*] Stopping all DNS Shield services...
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr ":8000"') do (
    taskkill /F /PID %%p >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr ":5173"') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo [OK] All services have been stopped.
echo Goodbye!
ping 127.0.0.1 -n 2 >nul
exit /b 0
