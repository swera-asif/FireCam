@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)
call npm --prefix showcase ci
if errorlevel 1 (
  echo Dependency installation failed. Check your connection and try again.
  pause
  exit /b 1
)
echo FireCam will be available at http://127.0.0.1:4180
echo Keep this window open. Press Ctrl+C to stop the server.
call npm start
if errorlevel 1 pause
