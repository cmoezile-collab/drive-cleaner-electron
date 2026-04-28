@echo off
setlocal
cd /d "%~dp0"
echo DCC Drive Doctor
echo.
if not exist "scripts\dcc-drive-doctor.js" (
  echo Missing scripts\dcc-drive-doctor.js
  pause
  exit /b 1
)
node "scripts\dcc-drive-doctor.js"
set EXITCODE=%ERRORLEVEL%
echo.
echo Drive doctor exit code: %EXITCODE%
echo.
echo If drives are listed here but not inside DCC, the bug is IPC/renderer-side.
echo If no drives are listed here, the bug is system/PowerShell/environment-side.
echo.
pause
exit /b %EXITCODE%
