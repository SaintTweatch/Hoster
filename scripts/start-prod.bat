@echo off
setlocal
cd /d "%~dp0\.."
if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
)
if not exist "frontend\dist" (
  echo Building frontend bundle...
  call npm --prefix frontend run build || exit /b 1
)
echo Starting DayZ Manager (single-process production mode)...
call npm --prefix backend start
endlocal
