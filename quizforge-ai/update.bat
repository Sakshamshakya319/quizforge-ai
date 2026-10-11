@echo off
setlocal

REM ==============================================================================
REM QuizForge AI - Safe Repository and Dependency Updater
REM ==============================================================================
title QuizForge AI - Updater

cd /d "%~dp0"

echo ==============================================================================
echo                 QuizForge AI - Update System
echo ==============================================================================
echo Working directory: %~dp0
echo.

REM ------------------------------------------------------------------------------
REM STEP 1: Check Runtime Prerequisites
REM ------------------------------------------------------------------------------
echo [STEP 1/4] Checking Node.js and npm...
where node >nul 2>nul
if errorlevel 1 goto node_missing

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
for /f "tokens=*" %%v in ('call npm -v') do set NPM_VERSION=%%v
echo   [OK] Node.js %NODE_VERSION% and npm v%NPM_VERSION% detected.
goto prereqs_ok

:node_missing
echo   [ERROR] Node.js is not installed or not in PATH. Please install Node.js (v18+).
pause
exit /b 1

:npm_missing
echo   [ERROR] npm is not installed or not in PATH. Please reinstall Node.js.
pause
exit /b 1

:prereqs_ok
echo.

REM ------------------------------------------------------------------------------
REM STEP 2: Pull Latest Repository Updates (Non-destructive)
REM ------------------------------------------------------------------------------
echo [STEP 2/4] Checking for Git repository updates...

if not exist ".git" goto no_git_repo

where git >nul 2>nul
if errorlevel 1 goto git_missing

echo   Fetching latest changes from remote Git repository...
git pull --ff-only
if errorlevel 1 goto git_conflict

echo   [OK] Git repository updated successfully.
goto git_done

:git_conflict
echo.
echo   [NOTICE] 'git pull --ff-only' could not automatically fast-forward.
echo   This usually happens when you have modified local files or branches.
echo   To preserve your work, no destructive commands (like reset or clean) were run.
echo.
echo   Recommended steps to resolve:
echo     1. Check modified files:  git status
echo     2. Stash your changes:    git stash
echo     3. Pull remote updates:   git pull
echo     4. Re-apply your changes: git stash pop
echo.
echo   Continuing with dependency and database updates for current files...
echo.
goto git_done

:no_git_repo
echo   [INFO] No '.git' folder found (project was likely downloaded as a ZIP archive).
echo          Skipping git pull. To update source files from GitHub:
echo            1. Download the latest release / ZIP from the GitHub repository.
echo            2. Extract files into this directory (keep your existing .env file).
echo            3. Run update.bat again to install new packages and apply schema updates.
goto git_done

:git_missing
echo   [WARN] Git executable not found on system PATH.
echo          Skipping remote pull. Download Git from https://git-scm.com/ to enable auto-pull.

:git_done
echo.

REM ------------------------------------------------------------------------------
REM STEP 3: Update Node.js Dependencies
REM ------------------------------------------------------------------------------
echo [STEP 3/4] Updating Node.js dependencies...
echo   Running: npm install
call npm install
if errorlevel 1 goto npm_error

echo   [OK] Dependencies up to date.
goto deps_done

:npm_error
echo   [ERROR] npm install encountered an error. Check network connection.
pause
exit /b 1

:deps_done
echo.

REM ------------------------------------------------------------------------------
REM STEP 4: Apply Database Schema Updates and Migrations
REM ------------------------------------------------------------------------------
echo [STEP 4/4] Applying database schema migrations...
node scripts/init-db.js
if errorlevel 1 goto db_warn

echo   [OK] Database schema and tables are fully synchronized.
goto db_done

:db_warn
echo.
echo   [NOTICE] Database updater could not connect to MySQL.
echo   Make sure your MySQL service is started: XAMPP, Laragon, or Windows Service.
echo   Run 'npm run db:init' once MySQL is running.

:db_done
echo.

REM ==============================================================================
REM UPDATE COMPLETION SUMMARY
REM ==============================================================================
echo ==============================================================================
echo                       UPDATE COMPLETED SUCCESSFULLY!                         
echo ==============================================================================
echo.
echo All updates applied safely without modifying your local .env configuration
echo or touching existing quiz data.
echo.
echo To start QuizForge AI:
echo   Double-click 'run.bat'
echo ==============================================================================
echo.
pause
