@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 (
  echo ERROR: Cannot access the project folder.
  if not "%TYPING_BUILD_NO_PAUSE%"=="1" pause
  exit /b 1
)

set "BUILD_EXIT=1"
set "BUILD_SCRIPT=build:all"
if not "%~2"=="" goto usage
if "%~1"=="" goto prerequisites
if /i "%~1"=="all" goto prerequisites
if /i "%~1"=="web" (
  set "BUILD_SCRIPT=build:web"
  goto prerequisites
)
if /i "%~1"=="windows" (
  set "BUILD_SCRIPT=build:windows"
  goto prerequisites
)
goto usage

:prerequisites
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_npm
call npm.cmd run %BUILD_SCRIPT%
set "BUILD_EXIT=%errorlevel%"
goto finish

:missing_node
echo ERROR: Node.js was not found in PATH. Install Node.js 22.12+, 24 LTS or 26+.
echo After installation, open a new terminal or Explorer window and retry.
goto finish

:missing_npm
echo ERROR: npm was not found in PATH. Reinstall Node.js with npm enabled.
goto finish

:usage
echo Usage: build.cmd [all^|web^|windows]
goto finish

:finish
if not "%BUILD_EXIT%"=="0" echo BUILD FAILED. See the error above; no successful delivery is claimed.
popd
if not "%TYPING_BUILD_NO_PAUSE%"=="1" pause
exit /b %BUILD_EXIT%