@echo off
setlocal
cd /d "%~dp0\.."
echo Installing root, backend, and frontend dependencies...
call npm install || goto :err
call npm --prefix backend install || goto :err
call npm --prefix frontend install || goto :err
echo.
echo Done. Run scripts\start.bat to launch the manager (dev mode).
exit /b 0
:err
echo Install failed. See output above.
exit /b 1
