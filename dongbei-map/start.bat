@echo off
chcp 65001 >nul
title 延边州数据可视化地图

echo ========================================
echo   延边朝鲜族自治州 · 数据可视化地图
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo [安装依赖] 首次运行，正在安装...
    call npm install
    echo.
)

echo [启动] 正在启动开发服务器...
echo [提示] 启动后浏览器访问下方地址即可
echo.
call npx vite --open
