@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0batch.ps1" %*
set "result=%errorlevel%"
if "%~1"=="" pause
exit /b %result%
