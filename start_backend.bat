@echo off
setlocal
cd /d "%~dp0"
title Parsel backend - keep this window open

if not exist backend\.env (
  echo Parsel is not set up yet. Double-click setup.bat first.
  pause
  exit /b 1
)

echo Starting the Parsel backend. Keep this window open while you use Parsel.
echo Next, double-click start_frontend.bat.
echo.
cd backend
..\venv\Scripts\python.exe -m uvicorn main:app
echo.
echo The backend stopped. See the message above.
pause
