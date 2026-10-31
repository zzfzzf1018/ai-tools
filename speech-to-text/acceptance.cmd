@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0validation\clean_windows.ps1" %*
set "RESULT=%ERRORLEVEL%"
if not "%STT_BUILD_NO_PAUSE%"=="1" pause
exit /b %RESULT%