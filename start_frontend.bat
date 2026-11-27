@echo off
setlocal
cd /d "%~dp0"
title Parsel frontend - keep this window open

if not exist frontend\node_modules (
  echo Parsel is not set up yet. Double-click setup.bat first.
  pause
  exit /b 1
)

echo ============================================
echo   Open Parsel in your browser:
echo   http://localhost:5173
echo.
echo   Keep this window and the backend window open.
echo ============================================
echo.
cd frontend
rem --strictPort: fail instead of silently moving to another port, so the link above stays right.
call npm run dev -- --strictPort
echo.
echo The frontend stopped. See the message above.
pause
