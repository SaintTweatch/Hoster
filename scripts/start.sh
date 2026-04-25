#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env

if ! node -e "require('./backend/node_modules/better-sqlite3')" >/dev/null 2>&1; then
  echo "[start] better-sqlite3 binding mismatch detected. Rebuilding from source..."
  npm_config_build_from_source=better-sqlite3 npm --prefix backend rebuild better-sqlite3 --foreground-scripts
fi

echo "Starting DayZ Manager (dev: backend + frontend with hot reload)..."
exec npm run dev
