@echo off
setlocal
cd /d "%~dp0"
node apply_round7A_npm_cmd_hotfix.js
if errorlevel 1 (
  echo.
  echo Hotfix failed.
  pause
  exit /b 1
)
echo.
echo Hotfix applied. Run:
echo   npm test
echo   npm run doctor
echo   npm run test:rc
pause
