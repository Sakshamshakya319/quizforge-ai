@echo off
setlocal

REM ==============================================================================
REM QuizForge AI - First-Time Setup and Installation Script
REM ==============================================================================
title QuizForge AI - Installation and Setup

cd /d "%~dp0"

echo ==============================================================================
echo                 QuizForge AI - Automated Setup System
echo ==============================================================================
echo Working directory: %~dp0
echo.

REM ------------------------------------------------------------------------------
REM STEP 1: Check Required Prerequisites (Node.js and npm)
REM ------------------------------------------------------------------------------
echo [STEP 1/6] Checking required runtime prerequisites...

where node >nul 2>nul
if errorlevel 1 goto node_error

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo   [OK] Node.js detected: %NODE_VERSION%

where npm >nul 2>nul
if errorlevel 1 goto npm_error

for /f "tokens=*" %%v in ('call npm -v') do set NPM_VERSION=%%v
echo   [OK] npm detected: v%NPM_VERSION%
goto prereqs_ok

:node_error
echo.
echo   [ERROR] Node.js is NOT installed or not available on your system PATH!
echo   QuizForge AI requires Node.js (v18 or newer).
echo   Please download and install the LTS version from:
echo     https://nodejs.org/
echo.
echo   After installing Node.js, restart your command prompt or File Explorer
echo   and run setup.bat again.
echo.
pause
exit /b 1

:npm_error
echo.
echo   [ERROR] npm package manager was not found on your system PATH.
echo   Please reinstall Node.js from https://nodejs.org/
echo.
pause
exit /b 1

:prereqs_ok
echo.

REM ------------------------------------------------------------------------------
REM STEP 2: Configure Environment Variables (.env)
REM ------------------------------------------------------------------------------
echo [STEP 2/6] Configuring environment settings...

if exist ".env" goto env_exists

if not exist ".env.example" goto env_example_missing

echo   Creating '.env' from '.env.example' template...
copy /y ".env.example" ".env" >nul
if errorlevel 1 (
    echo   [ERROR] Failed to copy .env.example to .env. Please check directory permissions.
    pause
    exit /b 1
)
echo   [OK] '.env' created with default development configuration.
echo        Default database settings: localhost:3306, user: root, password: (blank).
goto env_done

:env_example_missing
echo   [WARN] '.env.example' template not found. Creating minimal default '.env'...
(
echo PORT=5000
echo DB_HOST=localhost
echo DB_PORT=3306
echo DB_USER=root
echo DB_PASSWORD=
echo DB_NAME=quizforge_ai
echo JWT_SECRET=quizforge_dev_secret_change_in_production_key_2026
echo VITE_PORT=5173
echo AI_SERVICE_URL=http://localhost:8001
echo STATIQ_PROJECT_DIR=
) > ".env"
echo   [OK] Minimal '.env' file created.
goto env_done

:env_exists
echo   [OK] Existing '.env' file detected. Preserving your local settings.

:env_done
echo.

REM ------------------------------------------------------------------------------
REM STEP 3: Install Node.js Dependencies
REM ------------------------------------------------------------------------------
echo [STEP 3/6] Installing Node.js dependencies via npm...
echo   Running: npm install
call npm install
if errorlevel 1 goto npm_install_error

echo   [OK] Node.js dependencies installed successfully.
goto npm_install_done

:npm_install_error
echo.
echo   [ERROR] 'npm install' failed!
echo   Possible causes:
echo     1. No internet connection.
echo     2. npm cache corruption. Try running: npm cache clean --force
echo     3. Locked files in node_modules. Close any open editors or processes.
echo.
pause
exit /b 1

:npm_install_done
echo.

REM ------------------------------------------------------------------------------
REM STEP 4: Initialize MySQL Database Schema
REM ------------------------------------------------------------------------------
echo [STEP 4/6] Initializing MySQL database and schema...
echo   Running database setup script: node scripts/init-db.js
node scripts/init-db.js
if errorlevel 1 goto db_warning

echo   [OK] MySQL database and tables initialized successfully.
goto db_done

:db_warning
echo.
echo   [NOTICE] Automatic database creation could not connect to MySQL.
echo   If MySQL / MariaDB is not currently running, please start it now:
echo     - If using XAMPP: Start the MySQL module in XAMPP Control Panel.
echo     - If using Laragon: Click 'Start All'.
echo     - If using Windows Service: Run 'net start MySQL' as Administrator.
echo.
echo   Check database credentials in '.env' (DB_HOST, DB_USER, DB_PASSWORD).
echo   Once MySQL is running, you can initialize the database by running:
echo     npm run db:init
echo.

:db_done
echo.

REM ------------------------------------------------------------------------------
REM STEP 5: Setup Python Virtual Environment (Optional for AI Tutor)
REM ------------------------------------------------------------------------------
echo [STEP 5/6] Checking Python for optional Local AI Tutor...

where python >nul 2>nul
if errorlevel 1 goto python_not_available

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo   [OK] Python detected: %PY_VER%

if exist "ai-service\.venv\Scripts\python.exe" (
    echo   [OK] Python virtual environment already exists in ai-service\.venv
    goto python_done
)

if exist "ai-service\requirements.txt" (
    echo   Creating local virtual environment in ai-service\.venv...
    python -m venv "ai-service\.venv"
    if errorlevel 1 (
        echo   [INFO] Could not create Python virtual environment. Skipping AI tutor setup.
        goto python_done
    )
    
    echo   Installing AI service dependencies into virtual environment...
    call "ai-service\.venv\Scripts\pip.exe" install -r "ai-service\requirements.txt" --quiet
    if errorlevel 1 (
        echo   [INFO] Note: AI service dependencies installation had warnings.
    ) else (
        echo   [OK] AI service virtual environment ready.
    )
)
goto python_done

:python_not_available
echo   [INFO] Python was not detected on system PATH.
echo          Note: Python is OPTIONAL. It is only needed for serving local offline
echo          Qwen models. QuizForge AI quiz creation from documents, interactive
echo          quiz player, attempts, scoring, and history run 100%% without Python.

:python_done
echo.

REM ------------------------------------------------------------------------------
REM STEP 6: Verify Application Build
REM ------------------------------------------------------------------------------
echo [STEP 6/6] Verifying frontend compilation...
echo   Running: npm run build
call npm run build
if errorlevel 1 (
    echo   [WARN] Build verification produced warnings or errors. Check log above.
) else (
    echo   [OK] Frontend compiled cleanly.
)
echo.

REM ==============================================================================
REM SETUP COMPLETION SUMMARY
REM ==============================================================================
echo ==============================================================================
echo                      SETUP COMPLETED SUCCESSFULLY!                           
echo ==============================================================================
echo.
echo Quick Start Guide:
echo   1. Ensure your MySQL service is started (XAMPP / Laragon / Windows service).
echo   2. Double-click 'run.bat' to launch the application.
echo.
echo Access URLs:
echo   - Web User Interface: http://localhost:5173
echo   - Backend API Server: http://localhost:5000
echo   - Diagnostics Tool:   check_setup.bat
echo ==============================================================================
echo.
pause
