#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Installing root, backend, and frontend dependencies..."
npm install
npm --prefix backend install
npm --prefix frontend install
echo
echo "Done. Run scripts/start.sh to launch the manager (dev mode)."
