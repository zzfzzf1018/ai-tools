@echo off
setlocal
chcp 65001 >nul
title SpeechToText - Build Package
cd /d "%~dp0"
set "AUTO_FLAGS=-InstallPython -OpenOutput"
if "%STT_BUILD_NO_PAUSE%"=="1" set "AUTO_FLAGS=-InstallPython"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %AUTO_FLAGS% %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo Build failed. Keep this window and check the log path above.
) else (
  echo Build completed successfully.
)
if not "%STT_BUILD_NO_PAUSE%"=="1" pause
exit /b %RESULT%