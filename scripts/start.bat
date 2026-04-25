@echo off
setlocal
cd /d "%~dp0\.."
if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
)

rem --- Verify the native SQLite binding is compatible with the local Node version.
rem     If a previous install fetched a prebuild for the wrong ABI, rebuild it now.
node -e "try{require('./backend/node_modules/better-sqlite3');process.exit(0)}catch(e){console.error(e.message);process.exit(1)}" >nul 2>&1
if errorlevel 1 (
  echo [start] better-sqlite3 binding mismatch detected. Rebuilding from source for Node...
  set "npm_config_build_from_source=better-sqlite3"
  call npm --prefix backend rebuild better-sqlite3 --foreground-scripts || (
    echo [start] Rebuild failed. See output above.
    exit /b 1
  )
)

echo Starting DayZ Manager (dev: backend + frontend with hot reload)...
call npm run dev
endlocal
