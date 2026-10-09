@echo off
setlocal
set SCRIPT_DIR=%~dp0
python "%SCRIPT_DIR%translate_document.py" %* 
