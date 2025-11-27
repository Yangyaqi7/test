@echo off
chcp 65001 >nul 2>&1
title 心理咨询模拟系统
echo ========================================
echo     心理咨询模拟系统
echo ========================================
echo.
echo 正在启动代理服务器...
echo 请在浏览器中访问: http://localhost:3000/index.html
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

cd /d "%~dp0"
npm start