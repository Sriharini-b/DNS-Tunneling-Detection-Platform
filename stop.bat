@echo off

echo ============================================================
echo        STOPPING DNS SHIELD SERVICES
echo ============================================================
echo.

echo [*] Terminating processes on port 8000 (Backend)...
powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [*] Terminating processes on port 5173 (Frontend)...
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo  [OK] All DNS Shield services on ports 8000 and 5173 have been stopped.
echo ============================================================
echo.
ping 127.0.0.1 -n 2 >nul
