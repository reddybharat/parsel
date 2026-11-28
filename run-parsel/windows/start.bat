@echo off
rem Starts Parsel: backend in the background, frontend in this window, then opens
rem the browser. Close this window (or press Ctrl+C) to stop both.
setlocal
cd /d "%~dp0..\.."
title Parsel - close this window to stop

if not exist venv\Scripts\python.exe goto :not_set_up
if not exist frontend\node_modules goto :not_set_up
if not exist backend\.env goto :not_set_up

echo ============================================
echo   Parsel is starting. Your browser opens at
echo   http://localhost:5173 once it is ready.
echo.
echo   Keep this window open while you use Parsel.
echo   Close it to stop Parsel.
echo ============================================
echo.
start "" /b cmd /c "cd backend && ..\venv\Scripts\python.exe -m uvicorn main:app"
start "" /b venv\Scripts\python.exe run-parsel\open_browser.py
cd frontend
rem --strictPort: fail instead of silently moving to another port, so the link above stays right.
call npm run dev -- --strictPort
echo.
echo Parsel stopped. See any message above. Close this window to finish.
pause
exit /b 0

:not_set_up
echo Parsel is not set up yet. Double-click run-parsel\windows\setup.bat first.
pause
exit /b 1
