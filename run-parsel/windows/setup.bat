@echo off
rem Parsel setup and update: gets the latest code, installs missing programs and
rem packages, writes backend\.env once, and creates or upgrades the database.
rem Safe to run again at any time; that is how you update Parsel.
setlocal
cd /d "%~dp0..\.."
title Parsel setup

echo ============================================
echo   Parsel setup
echo ============================================
echo.

rem ---- 0. Latest code ---------------------------------------------------------
if "%~1"=="--pulled" (
  echo [0/5] Latest code ... updated
  goto :code_done
)
<nul set /p "=[0/5] Latest code ... "
if not exist .git (
  echo skipped: not a git download. To update, download the new version and copy the data folder into it.
  goto :code_done
)
where git >nul 2>&1 || (
  echo skipped: Git is not installed, so updates can't be downloaded.
  goto :code_done
)
set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if /i not "%BRANCH%"=="release" (
  echo skipped: this copy is on branch "%BRANCH%", updates come from "release".
  goto :code_done
)
echo.
rem The pull may replace this file, and cmd reads batch files as it goes, so the
rem restart has to be on the same line as the pull.
git pull --ff-only origin release && (call "%~f0" --pulled & exit /b) || (call :pull_failed & exit /b 1)
:code_done

rem ---- 1. Python ---------------------------------------------------------------
<nul set /p "=[1/5] Python 3.11+ ... "
call :python_version
if defined PYV (
  echo found %PYV%
  goto :python_ok
)
echo not found, installing with winget...
call :need_winget || goto :fail
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --override "/passive PrependPath=1" || goto :fail
call :refresh_path
call :python_version
if not defined PYV (
  echo Python was installed but this window can't find it yet. Close this window and run setup again.
  goto :fail
)
echo       installed %PYV%
:python_ok

rem ---- 2. Node.js --------------------------------------------------------------
<nul set /p "=[2/5] Node.js 18+ ... "
call :node_version
if defined NODEV (
  echo found %NODEV%
  goto :node_ok
)
echo not found, installing with winget...
call :need_winget || goto :fail
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements || goto :fail
call :refresh_path
call :node_version
if not defined NODEV (
  echo Node.js was installed but this window can't find it yet. Close this window and run setup again.
  goto :fail
)
echo       installed %NODEV%
:node_ok

rem ---- 3. Backend packages -----------------------------------------------------
echo [3/5] Backend packages (can take a few minutes the first time) ...
if not exist venv\Scripts\python.exe (
  python -m venv venv || goto :fail
)
venv\Scripts\python.exe -m pip install --disable-pip-version-check -q -r backend\requirements.txt || goto :fail
echo       up to date

rem ---- 4. Frontend packages ----------------------------------------------------
echo [4/5] Frontend packages ...
pushd frontend
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  popd
  goto :fail
)
popd
echo       up to date

rem ---- 5. Settings and database ------------------------------------------------
echo [5/5] Settings and database ...
venv\Scripts\python.exe run-parsel\configure.py || goto :fail

echo.
echo ============================================
echo   Setup finished. To use Parsel, double-click
echo   run-parsel\windows\start.bat
echo ============================================
pause
exit /b 0

:fail
echo.
echo Setup did not finish. Fix the problem above, then run setup.bat again.
pause
exit /b 1

:pull_failed
echo.
echo Could not update the code; git's message is above. Usually this means files in
echo this folder were edited. Undo those edits (or ask for help), then run setup again.
echo Your data was not touched.
pause
exit /b 1

:python_version
set "PYV="
for /f "delims=" %%v in ('python -c "import sys, platform; print(platform.python_version()) if sys.version_info >= (3, 11) else sys.exit(1)" 2^>nul') do set "PYV=%%v"
exit /b 0

:node_version
set "NODEV="
set "NODE_MAJOR="
for /f "tokens=1 delims=v." %%m in ('node -v 2^>nul') do set "NODE_MAJOR=%%m"
if not defined NODE_MAJOR exit /b 0
if %NODE_MAJOR% LSS 18 exit /b 0
for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"
exit /b 0

:refresh_path
rem winget changes PATH in the registry only; reload it so this window sees new programs.
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%p"
exit /b 0

:need_winget
where winget >nul 2>&1 && exit /b 0
echo winget, the Windows app installer, is missing. Install "App Installer" from the
echo Microsoft Store, or install Python 3.12 (python.org) and Node.js LTS (nodejs.org) yourself.
exit /b 1
