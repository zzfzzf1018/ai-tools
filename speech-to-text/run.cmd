@echo off
cd /d "%~dp0"
if exist "dist\SpeechToText\SpeechToText.exe" (
  "dist\SpeechToText\SpeechToText.exe" gui
) else if exist ".build-venv\Scripts\python.exe" (
  ".build-venv\Scripts\python.exe" -m speech_to_text gui
) else (
  echo Run build.cmd first.
  pause
  exit /b 1
)