@echo off
chcp 65001 >nul
title 构建静态版本

echo ========================================
echo   构建延边州地图（静态 HTML 版本）
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo [安装依赖]...
    call npm install
    echo.
)

echo [构建中]...
call npx vite build

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   构建完成！
    echo   双击 dist\open.bat 即可查看
    echo ========================================
    echo.
    start dist\open.bat
) else (
    echo.
    echo [错误] 构建失败
)

pause
