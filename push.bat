@echo off
chcp 65001 >nul
setlocal

title GitHub Push - DNS Shield

echo ============================================================
echo        PUSHING CODE TO GITHUB REPOSITORY
echo   https://github.com/Sriharini-b/DNS-Tunneling-Detection-Platform.git
echo ============================================================
echo.

set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"

if not exist "%GIT_CMD%" (
    set "GIT_CMD=git"
)

echo [*] Staging any modified files...
"%GIT_CMD%" add .

echo [*] Checking commit...
"%GIT_CMD%" commit -m "feat: complete DNS Tunneling Detection Platform with ML, AI Chat, and React UI" 2>nul

echo [*] Setting branch to main...
"%GIT_CMD%" branch -M main

echo [*] Configuring remote origin...
"%GIT_CMD%" remote remove origin 2>nul
"%GIT_CMD%" remote add origin https://github.com/Sriharini-b/DNS-Tunneling-Detection-Platform.git

echo [*] Pushing to GitHub (origin main)...
echo.
echo [!] If prompted, please complete the GitHub sign-in in your browser window.
echo.
"%GIT_CMD%" push -u origin main

echo.
if errorlevel 1 (
    echo [X] Push encountered an issue. Check your GitHub permissions/sign-in above.
) else (
    echo ============================================================
    echo  [OK] Successfully pushed all files to GitHub!
    echo ============================================================
)

echo.
pause
