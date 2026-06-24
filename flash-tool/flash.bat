@echo off
chcp 65001 >nul
echo === KureRobo ESP32 書き込みツール(ポータブル版) ===
echo USB で ESP32 を接続してから、何かキーを押してください。
echo (書き込み中はUSBを抜かないこと)
echo.
pause
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0flash.ps1"
echo.
pause
