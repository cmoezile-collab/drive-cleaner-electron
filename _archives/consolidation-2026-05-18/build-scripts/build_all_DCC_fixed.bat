@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "STAMP=%DATE:~-4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
set "STAMP=%STAMP: =0%"
if not exist logs mkdir logs
set "LOG=logs\dcc_build_all_%STAMP%.log"

call :banner "DCC BUILD ALL"
echo Project: %CD%
echo Log: %LOG%
echo ============================================================
echo.

if not exist package.json (
  echo [ERROR] package.json not found. Run from the Drive Cleaner project root.
  pause
  exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js was not found in PATH.
  echo         Install Node.js, then reopen this terminal and try again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] npm was not found in PATH.
  echo         Install Node.js/npm, then reopen this terminal and try again.
  pause
  exit /b 1
)

call :run "Node version" "node --version" || goto :fail
call :run "npm version" "npm --version" || goto :fail
call :run "Install / refresh dependencies" "npm install" || goto :fail
call :run "Run DCC RC gates" "npm test" || goto :fail

if exist dist (
  echo.
  echo [Clean] Removing previous dist artifacts...
  echo [%DATE% %TIME%] Clean dist >> "%LOG%"
  rmdir /s /q dist >> "%LOG%" 2>&1
  if %ERRORLEVEL% NEQ 0 goto :fail
)

call :run "Build Windows installer and portable" "npm run build:win" || goto :fail

call :banner "BUILD COMPLETE"
echo.
dir /b dist\*.exe 2>nul
echo.
echo Manual QA still required before release:
echo   - Launch portable build
echo   - Install setup build
echo   - Confirm admin elevation
echo   - Refresh drives
echo   - Run safe scan-only test
echo   - Do NOT format any real drive unless intentionally testing with disposable media
echo.
pause
exit /b 0

:run
set "RUN_LABEL=%~1"
set "RUN_CMD=%~2"
echo.
echo ^> %RUN_LABEL%
echo [%DATE% %TIME%] %RUN_LABEL% >> "%LOG%"
echo CMD: %RUN_CMD% >> "%LOG%"
call %RUN_CMD% >> "%LOG%" 2>&1
set "RUN_CODE=%ERRORLEVEL%"
if not "%RUN_CODE%"=="0" exit /b %RUN_CODE%
exit /b 0

:banner
echo ============================================================
echo   %~1
echo ============================================================
exit /b 0

:fail
echo.
echo ============================================================
echo   BUILD FAILED
echo ============================================================
echo Check log: %LOG%
echo.
powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 80" 2>nul
echo.
pause
exit /b 1
