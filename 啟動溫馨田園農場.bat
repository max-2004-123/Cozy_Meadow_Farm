@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 🌻 正在啟動 Sunnybrook Farm 溫馨3D田園農場...
echo.
start "" http://localhost:5175
call npm.cmd run dev
pause
