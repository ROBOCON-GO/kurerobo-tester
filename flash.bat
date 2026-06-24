@echo off
chcp 65001 >nul
echo === KureRobo ESP32 Flasher (arduino-cli) ===
echo USB で ESP32 を接続してから続行してください。
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0flash.ps1"
echo.
pause
