@echo off
rem One-time Parsel setup: installs missing programs, creates the database,
rem installs packages and writes backend\.env. Safe to run again to update packages.
setlocal
cd /d "%~dp0"
title Parsel setup

echo ============================================
echo   Parsel setup
echo ============================================
echo.

rem ---- 1. Required programs ------------------------------------------------
set "INSTALLED="

python -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
if not errorlevel 1 goto :python_ok
call :need_winget || goto :fail
echo Installing Python...
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --override "/passive PrependPath=1" || goto :fail
set "INSTALLED=1"
:python_ok

node -e "process.exit(Number(process.versions.node.split('.')[0]) < 18 ? 1 : 0)" >nul 2>&1
if not errorlevel 1 goto :node_ok
call :need_winget || goto :fail
echo Installing Node.js...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements || goto :fail
set "INSTALLED=1"
:node_ok

call :find_postgres
where psql >nul 2>&1
if not errorlevel 1 goto :postgres_ok
call :need_winget || goto :fail
echo.
echo PostgreSQL, the database, is not installed. Its installer opens next:
echo   - Keep every default, including port 5432.
echo   - Choose a password for the "postgres" user and WRITE IT DOWN.
echo     This setup asks for it in a moment.
echo   - On the last page, untick "Stack Builder" and click Finish.
echo.
pause
winget install -e --id PostgreSQL.PostgreSQL.18 --interactive --accept-package-agreements --accept-source-agreements || goto :fail
call :find_postgres
:postgres_ok

if not defined INSTALLED goto :programs_ok
echo.
echo New programs were installed. Close this window and double-click
echo setup.bat again to continue.
pause
exit /b 0
:programs_ok

rem ---- 2. Packages ----------------------------------------------------------
echo.
echo Installing backend packages (this can take a few minutes)...
if not exist venv\Scripts\python.exe python -m venv venv || goto :fail
venv\Scripts\python.exe -m pip install --disable-pip-version-check -q -r backend\requirements.txt || goto :fail

echo Installing frontend packages...
pushd frontend
call npm install --no-audit --no-fund
if errorlevel 1 (popd & goto :fail)
popd

rem ---- 3. Database and settings ---------------------------------------------
if not exist backend\.env goto :database
echo.
echo backend\.env already exists, so the database is already set up. Skipping.
goto :done

:database
echo.
echo Enter the password you chose for the "postgres" user when installing PostgreSQL.
:ask_password
set "PGPASSWORD="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$s = Read-Host 'Password' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))"`) do set "PGPASSWORD=%%p"
psql -w -h localhost -U postgres -tAc "select 1" >nul
if errorlevel 1 (
  echo That did not work. Check the password, and that PostgreSQL is running, then try again.
  goto :ask_password
)

set "EXISTING="
for /f "usebackq" %%n in (`psql -w -h localhost -U postgres -tAc "select (select count(*) from pg_roles where rolname in ('parsel', 'parsel_agent')) + (select count(*) from pg_database where datname = 'parsel')"`) do set "EXISTING=%%n"
if not "%EXISTING%"=="0" (
  echo.
  echo A Parsel database or login already exists on this PostgreSQL, but backend\.env is missing.
  echo Nothing was changed. Follow "First-time setup" in README.md to connect to it.
  goto :fail
)

for /f %%s in ('venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(24))"') do set "PARSEL_PW=%%s"
for /f %%s in ('venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(24))"') do set "AGENT_PW=%%s"
for /f %%s in ('venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"') do set "JWT_SECRET=%%s"

echo Creating the database...
set "PGCLIENTENCODING=UTF8"
set "PSQL=psql -w -h localhost -U postgres -q -v ON_ERROR_STOP=1"
%PSQL% -c "CREATE ROLE parsel LOGIN PASSWORD '%PARSEL_PW%';" || goto :database_fail
%PSQL% -c "CREATE DATABASE parsel OWNER parsel;" || goto :database_fail

rem 008 creates a login, so it runs as postgres; every other script runs as parsel so parsel owns the tables.
for %%f in (migrations\*.sql) do (
  if /i "%%~nf"=="008_chat_agent_role" (
    %PSQL% -d parsel -f "%%f" -c "ALTER ROLE parsel_agent PASSWORD '%AGENT_PW%';" || goto :database_fail
  ) else (
    %PSQL% -d parsel -c "SET ROLE parsel;" -f "%%f" || goto :database_fail
  )
)
rem STEP B of 002, which is commented out there; the table is empty on a fresh database.
%PSQL% -d parsel -c "SET ROLE parsel;" -c "ALTER TABLE public.transactions ALTER COLUMN user_id SET NOT NULL;" -c "ALTER TABLE public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);" || goto :database_fail

echo.
echo The chat assistant needs a free Groq API key from https://console.groq.com/keys
echo Paste it here and press Enter, or just press Enter to skip. Everything else works without it.
set "GROQ_API_KEY="
set /p "GROQ_API_KEY=Groq API key: "

(
  echo DATABASE_URL=postgresql://parsel:%PARSEL_PW%@localhost:5432/parsel
  echo CHAT_DATABASE_URL=postgresql://parsel_agent:%AGENT_PW%@localhost:5432/parsel
  echo JWT_SECRET=%JWT_SECRET%
  echo GROQ_API_KEY=%GROQ_API_KEY%
) > backend\.env || goto :fail

:done
echo.
echo ============================================
echo   Setup finished. To use Parsel, double-click
echo   start_backend.bat, then start_frontend.bat.
echo ============================================
pause
exit /b 0

:database_fail
echo.
echo Database setup failed, see the message above. Undoing the half-made database...
psql -w -h localhost -U postgres -q -c "DROP DATABASE IF EXISTS parsel;" -c "DROP ROLE IF EXISTS parsel_agent;" -c "DROP ROLE IF EXISTS parsel;"
:fail
echo.
echo Setup did not finish. Fix the problem above, then double-click setup.bat again.
pause
exit /b 1

:need_winget
where winget >nul 2>&1 && exit /b 0
echo winget, the Windows app installer, is missing. Install "App Installer" from the
echo Microsoft Store, or install Python 3.12, Node.js LTS and PostgreSQL yourself.
exit /b 1

:find_postgres
where psql >nul 2>&1 && exit /b 0
for /d %%d in ("%ProgramFiles%\PostgreSQL\*") do if exist "%%d\bin\psql.exe" set "PATH=%PATH%;%%d\bin"
exit /b 0
