@echo off
timeout /t 10 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --edge-touch-filtering --incognito "http://localhost:5173"
