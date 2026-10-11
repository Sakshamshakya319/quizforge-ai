@echo off
setlocal

REM ==============================================================================
REM QuizForge AI - Application Launcher
REM ==============================================================================
title QuizForge AI - Application Launcher

cd /d "%~dp0"

echo ==============================================================================
echo                      QuizForge AI - Starting Services
echo ==============================================================================
echo Working directory: %~dp0
echo.

REM 1. Check if setup was performed
if not exist "node_modules\" goto missing_deps
if not exist ".env" goto missing_env

goto check_mysql

:missing_deps
echo [ERROR] Dependencies are not installed ('node_modules' is missing).
echo Please run 'setup.bat' first to install required packages.
echo.
pause
exit /b 1

:missing_env
echo [WARNING] Configuration file '.env' was not found.
if exist ".env.example" goto restore_env

echo [ERROR] Neither '.env' nor '.env.example' was found.
echo Please run 'setup.bat' to restore configuration templates.
pause
exit /b 1

:restore_env
echo Creating default '.env' from '.env.example'...
copy /y ".env.example" ".env" >nul
echo Created default '.env'.

:check_mysql
REM 2. Check database status (non-fatal warning if offline)
echo Checking MySQL database connectivity...
node scripts/check-db.js >nul 2>nul
if errorlevel 1 goto db_offline

echo [OK] MySQL database connection verified.
goto ready_to_launch

:db_offline
echo.
echo ==============================================================================
echo [WARNING] MySQL database server is not reachable at the configured port.
echo           Please ensure your MySQL or MariaDB service is started:
echo             - XAMPP: Start MySQL module in XAMPP Control Panel
echo             - Laragon: Click 'Start All'
echo             - Windows Service: net start MySQL
echo.
echo           The application will launch, but database features will fail
echo           until MySQL is online.
echo ==============================================================================
echo.

:ready_to_launch
REM 3. Banner and URL Display
echo ==============================================================================
echo                         QUIZFORGE AI IS STARTING
echo ==============================================================================
echo.
echo   Web Application:     http://localhost:5173
echo   Backend API Server:  http://localhost:5000
echo   Database Status:     http://localhost:5000/api/health
echo.
echo   To stop all services: Press Ctrl+C in this terminal window.
echo ==============================================================================
echo.

REM 4. Start all services concurrently (Frontend, API, and AI tutor monitor)
call npm run dev:all

REM 5. Troubleshooting on exit
echo.
echo ==============================================================================
echo                       Application Stopped
echo ==============================================================================
echo If the application shut down unexpectedly:
echo   1. Check if ports 5173 or 5000 are already in use by another program.
echo   2. Double-click 'check_setup.bat' to run system diagnostics.
echo   3. Review the terminal logs above for specific error traces.
echo ==============================================================================
echo.
pause
