@echo off
setlocal
node "%~dp0apply_round11F_npm_doctor_hotfix.js"
if errorlevel 1 pause
