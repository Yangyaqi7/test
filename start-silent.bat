@echo off
title 心理咨询模拟系统 - 静默模式
cd /d "%~dp0"
start /B cmd /c "npm start >nul 2>&1"
echo 服务器已在后台启动...
echo 请在浏览器中访问: http://localhost:3000/index.html
echo.
pause