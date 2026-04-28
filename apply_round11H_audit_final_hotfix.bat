@echo off
setlocal
node "%~dp0apply_round11H_audit_final_hotfix.js"
if errorlevel 1 exit /b 1
npm run test:audit
