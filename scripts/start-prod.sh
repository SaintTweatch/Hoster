#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
if [ ! -d frontend/dist ]; then
  echo "Building frontend bundle..."
  npm --prefix frontend run build
fi
echo "Starting DayZ Manager (single-process production mode)..."
exec npm --prefix backend start
