@echo off
rem Double-click to launch the app (same as: npm start). Console window is used for the monitor prompt.
title tangowebapp
cd /d "%~dp0"

where node >/dev/null 2>&1
if errorlevel 1 (
  echo Node.js not found. Install it from https://nodejs.org and run again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 (
  echo.
  echo App exited with an error.
  pause
)
