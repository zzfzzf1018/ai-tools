@echo off
setlocal EnableExtensions DisableDelayedExpansion
call "%~dp0build.cmd" windows
exit /b %errorlevel%