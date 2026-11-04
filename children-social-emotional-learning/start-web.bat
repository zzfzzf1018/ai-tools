@echo off
setlocal
cd /d "%~dp0"

rem Prefer a local Python static server, then open the browser.
where python >nul 2>nul
if %errorlevel%==0 goto :serve_python
where py >nul 2>nul
if %errorlevel%==0 goto :serve_py
goto :open_file

:serve_python
start "SunnyIslesServer" /min cmd /c "python -m http.server 5173"
goto :wait_and_open

:serve_py
start "SunnyIslesServer" /min cmd /c "py -m http.server 5173"
goto :wait_and_open

:wait_and_open
ping -n 2 127.0.0.1 >nul 2>&1
start "" "http://localhost:5173/index.html"
goto :eof

rem No Python found: open index.html directly with the default program (file://).
:open_file
start "" "%~dp0index.html"
goto :eof
