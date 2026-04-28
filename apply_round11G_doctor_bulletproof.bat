@echo off
setlocal
node "%~dp0apply_round11G_doctor_bulletproof.js"
if errorlevel 1 (
  echo.
  echo Round 11G apply failed.
  pause
  exit /b 1
)
echo.
echo Now run:
echo   npm run doctor
echo   npm run test:rc
echo   build_all.bat
pause
