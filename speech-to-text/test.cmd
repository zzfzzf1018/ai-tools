@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -TestOnly %*
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%