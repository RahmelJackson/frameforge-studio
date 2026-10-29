@echo off
setlocal
if not exist "%~dp0scripts\quickstart.ps1" (
  echo Extract the whole Frameforge ZIP folder first, then open Start Frameforge.cmd again.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\quickstart.ps1" %*
if errorlevel 1 (pause) else (
  echo Keep this folder for future launches. The Studio address is shown above.
  timeout /t 12
)
