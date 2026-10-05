@echo off
rem Double-click to start the app (named by BRAND_NAME, default Polygossa): backend on :8080, frontend on :3000, then opens the browser.
rem Close the "<name> backend" / "<name> frontend" windows to stop the servers.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
if errorlevel 1 pause
"%SystemRoot%\System32\timeout.exe" /t 5 >nul
