@echo off
title Wire Buzz Arena - EEE Fest 2026 Launcher
echo =========================================================================
echo       EEE Fest 2026 - Wire Buzz Arena Controller Launcher
echo             Organized by IEEE PES DIU SBC & DIU EEE
echo =========================================================================
echo.
echo Starting Local Web Server on http://localhost:8080 ...
echo Opening Projector Presenter Screen and Admin Dashboard in Default Browser...
echo.

start "" "http://localhost:8080/index.html"
timeout /t 1 >nul
start "" "http://localhost:8080/admin.html"

python -m http.server 8080
pause
