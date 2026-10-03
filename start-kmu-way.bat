@echo off
setlocal
cd /d "%~dp0mobile-android\local-crawler"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js LTS.
  pause
  exit /b 1
)
echo KMU WAY: http://127.0.0.1:8000
start "" "http://127.0.0.1:8000"
node server.mjs --port 8000
pause
