@echo off
REM Starts UniMate Studio: builds the React app if needed and serves everything on http://localhost:8000
cd /d "%~dp0.."

if not exist "UI\frontend\node_modules" (
  echo Instalando dependencias del frontend...
  pushd UI\frontend
  call npm install
  popd
)

if not exist "UI\frontend\dist\index.html" (
  echo Compilando la interfaz...
  pushd UI\frontend
  call npm run build
  popd
)

start "" http://localhost:8000
".venv\Scripts\python.exe" -m uvicorn main:app --app-dir UI/backend --host 127.0.0.1 --port 8000
