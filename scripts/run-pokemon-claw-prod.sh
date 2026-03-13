#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../frontend" && pwd)"
PIDFILE="/tmp/pokemon-claw-frontend-prod.pid"

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-3008}"
export OPENCLAW_STATUS_POLL_INTERVAL_MS="${OPENCLAW_STATUS_POLL_INTERVAL_MS:-15000}"
export OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS="${OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS:-300}"
export OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS="${OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS:-5000}"
export OPENCLAW_STATIC_ROOT="${OPENCLAW_STATIC_ROOT:-dist}"

cd "$ROOT"

if [[ -f "$PIDFILE" ]]; then
  old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    exit 0
  fi
fi

nohup npm run start:prod >/dev/null 2>&1 &
echo $! > "$PIDFILE"
