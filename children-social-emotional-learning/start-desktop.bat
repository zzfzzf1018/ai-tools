@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies, please wait...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    goto :eof
  )
)

echo Starting desktop app...
call npm run start
goto :eof
