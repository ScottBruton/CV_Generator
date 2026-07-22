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
echo   - React app (Vite) at http://127.0.0.1:5173
echo   - API + PDF export at http://127.0.0.1:3001
echo.
echo Freeing ports 3001 and 5173 if needed...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo.
echo Opening http://127.0.0.1:5173 in your browser when ready...
echo Press Ctrl+C to stop.
echo.

rem Wait until Vite is listening, then open the app in the default browser.
start "CV Generator browser" /min cmd /c "for /l %%i in (1,1,45) do @(netstat -ano ^| findstr :5173 ^| findstr LISTENING >nul && start http://127.0.0.1:5173 && exit /b 0) & timeout /t 1 /nobreak >nul"

call npm start
if errorlevel 1 (
  echo.
  echo Start failed.
  pause
  exit /b 1
)
