@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Resolve repo root
cd /d "%~dp0"
set "ROOT=%CD%"

echo [ai-emotion] Repo: %ROOT%

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found. Please install Python 3.10+ and ensure it is on PATH.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 18+ and ensure it is on PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js 18+ (includes npm) and ensure it is on PATH.
  pause
  exit /b 1
)

rem Create/activate venv
if not exist ".venv\\Scripts\\activate.bat" (
  echo [ai-emotion] Creating venv...
  python -m venv .venv
  if errorlevel 1 exit /b 1
)

call ".venv\\Scripts\\activate.bat"
if errorlevel 1 exit /b 1

echo [ai-emotion] Installing backend deps...
python -m pip install --upgrade pip
python -m pip install -r "server\\requirements.txt"
if errorlevel 1 exit /b 1

rem Download Vosk model if missing
if not exist "vosk-model-small-cn" (
  echo [ai-emotion] Downloading Vosk model...
  python "server\\scripts\\download_vosk_model.py"
  if errorlevel 1 exit /b 1
)

rem Install frontend deps if missing
if not exist "client\\node_modules" (
  echo [ai-emotion] Installing frontend deps...
  pushd "client"
  npm install
  if errorlevel 1 popd & exit /b 1
  popd
)

rem Build frontend only if not built yet
if not exist "client\\.next" (
  echo [ai-emotion] Building frontend...
  pushd "client"
  set "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000"
  set "NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws/events"
  npm run build
  if errorlevel 1 popd & exit /b 1
  popd
)

echo [ai-emotion] Starting backend and frontend...

start "ai-emotion server" cmd /k "cd /d \"%ROOT%\" && call .venv\\Scripts\\activate.bat && python -m uvicorn server.app.main:app --host 127.0.0.1 --port 8000"
start "ai-emotion client" cmd /k "cd /d \"%ROOT%\\client\" && set NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000 && set NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws/events && npm run start"

echo [ai-emotion] Opening dashboard...
timeout /t 2 >nul
start http://localhost:3000

echo [ai-emotion] Done.
exit /b 0

