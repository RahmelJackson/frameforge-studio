@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\quickstart.ps1" -StopStudio
if errorlevel 1 pause
