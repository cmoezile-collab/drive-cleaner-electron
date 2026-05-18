@echo off
setlocal
cd /d "%~dp0"
echo Applying DCC Round 4E MAX_LOG_ENTRIES hotfix...
node apply_round4E_log_constant_hotfix.js
if errorlevel 1 (
  echo.
  echo Round 4E hotfix failed.
  pause
  exit /b 1
)
echo.
echo Round 4E hotfix applied. Run: npm test && npm start
pause
