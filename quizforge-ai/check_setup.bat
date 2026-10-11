@echo off
setlocal

REM ==============================================================================
REM QuizForge AI - System Diagnostics and Prerequisite Checker
REM ==============================================================================
title QuizForge AI - Diagnostics

cd /d "%~dp0"

echo ==============================================================================
echo                 QuizForge AI - System Diagnostics Check
echo ==============================================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto node_missing

REM Run the deep diagnostics engine
node scripts/check-system.js
goto finish

:node_missing
echo [FAIL] Node.js is NOT installed or not added to your system PATH.
echo.
echo QuizForge AI requires Node.js (version 18 or newer).
echo Please download and install the LTS version from:
echo   https://nodejs.org/
echo.
echo After installing Node.js, restart your command prompt or File Explorer
echo and double-click check_setup.bat again.
echo.

:finish
echo.
pause
