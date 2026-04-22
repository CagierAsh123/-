@echo off
title Build Yanbian Map

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

if not exist node_modules (
    echo [Installing deps]...
    call npm install
    echo.
)

:: auto-sync latest exported JSON if found in Downloads or current dir
set "LATEST_JSON="
for /f "delims=" %%f in ('dir /b /o-d yanbian-map-data-*.json 2^>nul') do (
    if not defined LATEST_JSON set "LATEST_JSON=%%f"
)
if not defined LATEST_JSON (
    for /f "delims=" %%f in ('dir /b /o-d "%USERPROFILE%\Downloads\yanbian-map-data-*.json" 2^>nul') do (
        if not defined LATEST_JSON set "LATEST_JSON=%USERPROFILE%\Downloads\%%f"
    )
)

if defined LATEST_JSON (
    echo [Sync] %LATEST_JSON%
    call node sync-data.mjs "%LATEST_JSON%"
    echo.
) else (
    echo [Skip] No exported JSON found, using existing userData.js
    echo.
)

echo [Building]...
call npx vite build

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Done! dist\open.bat
    echo ========================================
    echo.
    start dist\open.bat
) else (
    echo.
    echo [ERROR] Build failed
)

pause
