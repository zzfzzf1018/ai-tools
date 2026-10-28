@echo off
rem 一键打包：双击运行即可（也可在命令行里带参数，如 --skip-tests）
chcp 65001 >nul
cd /d "%~dp0"
python tools\package.py %*
set EXITCODE=%ERRORLEVEL%
echo.
pause
exit /b %EXITCODE%
