@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)
echo FireCam will be available at http://localhost:4173
echo Keep this window open. Press Ctrl+C to stop the server.
node server.mjs
if errorlevel 1 pause
