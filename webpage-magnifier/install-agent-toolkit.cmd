@echo off
setlocal
title Agent Toolkit Installer

echo Agent Toolkit installer
echo Enter a new or existing project directory.
set "TARGET_PATH="
set /p "TARGET_PATH=Project directory: "
if not defined TARGET_PATH (
    set "FAILURE=No project directory was provided."
    set "EXIT_CODE=2"
    goto :failure
)

rem Windows paths cannot contain double quotes; accept optional surrounding quotes.
set "TARGET_PATH=%TARGET_PATH:"=%"
if not defined TARGET_PATH (
    set "FAILURE=No project directory was provided."
    set "EXIT_CODE=2"
    goto :failure
)

where.exe pwsh.exe >nul 2>nul
if errorlevel 1 (
    set "FAILURE=PowerShell 7 or later (pwsh.exe) was not found on PATH."
    set "EXIT_CODE=9009"
    goto :failure
)

set "PS_MAJOR="
for /f "delims=" %%V in ('pwsh.exe -NoLogo -NoProfile -Command "$PSVersionTable.PSVersion.Major" 2^>nul') do set "PS_MAJOR=%%V"
if not defined PS_MAJOR (
    set "FAILURE=Could not determine the PowerShell version."
    set "EXIT_CODE=1"
    goto :failure
)
if %PS_MAJOR% LSS 7 (
    set "FAILURE=PowerShell 7 or later is required; found major version %PS_MAJOR%."
    set "EXIT_CODE=1"
    goto :failure
)

echo Installing toolkit into "%TARGET_PATH%"...
pwsh.exe -NoLogo -NoProfile -File "%~dp0scripts\install-agent-toolkit.ps1" -TargetPath "%TARGET_PATH%"
set "INSTALL_EXIT_CODE=%ERRORLEVEL%"
if not "%INSTALL_EXIT_CODE%"=="0" (
    set "FAILURE=The PowerShell installer failed with exit code %INSTALL_EXIT_CODE%."
    set "EXIT_CODE=%INSTALL_EXIT_CODE%"
    goto :failure
)

echo.
echo Agent Toolkit installation succeeded.
pause
endlocal & exit /b 0

:failure
echo.
echo ERROR: %FAILURE%
pause
endlocal & exit /b %EXIT_CODE%
