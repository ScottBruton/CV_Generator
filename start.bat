@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting CV Generator...
echo   - Builds index.html once
echo   - Watches content, components, CSS, and assets for changes
echo   - Serves the CV at http://localhost:3000
echo.
echo Press Ctrl+C to stop.
echo.

call npm start
if errorlevel 1 (
  echo.
  echo Start failed.
  pause
  exit /b 1
)
