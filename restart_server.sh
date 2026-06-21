#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-3001}"

echo "Stopping existing server on port ${PORT}..."
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:${PORT} -sTCP:LISTEN || true)"
  if [[ -n "${PIDS}" ]]; then
    kill ${PIDS}
    sleep 1
  fi
else
  echo "lsof not found, skipping port-based shutdown."
fi

echo "Rebuilding frontend..."
npm run build

echo "Starting server..."
npm start
