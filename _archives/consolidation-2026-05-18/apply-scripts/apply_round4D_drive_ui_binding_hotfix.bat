@echo off
setlocal
cd /d "%~dp0"
node apply_round4D_drive_ui_binding_hotfix.js
if errorlevel 1 (
  echo.
  echo DCC Round 4D patch failed.
  pause
  exit /b 1
)
echo.
echo DCC Round 4D patch applied.
echo Run: npm test ^&^& npm start
pause
