@echo off
REM Double-click this to publish the site.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
pause
