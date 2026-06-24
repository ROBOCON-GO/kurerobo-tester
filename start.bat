@echo off
chcp 65001 >nul
cd /d "%~dp0docs"
echo === KureRobo Tester サーバー起動 ===
echo ブラウザ(Chrome/Edge)で http://localhost:8080 を開きます。
echo この黒い画面は開いたままにしてください(閉じるとサーバーも止まります)。
echo 止めるときは Ctrl+C。
echo.
start "" http://localhost:8080
python -m http.server 8080
