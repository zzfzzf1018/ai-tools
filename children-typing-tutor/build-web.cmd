@echo off
setlocal EnableExtensions DisableDelayedExpansion
call "%~dp0build.cmd" web
exit /b %errorlevel%