#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../frontend" && pwd)"
LOG="/tmp/pokemon-claw-frontend-dev.log"
PIDFILE="/tmp/pokemon-claw-frontend-dev.pid"

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-3010}"
export OPENCLAW_STATUS_POLL_INTERVAL_MS="${OPENCLAW_STATUS_POLL_INTERVAL_MS:-5000}"
export OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS="${OPENCLAW_STATUS_REFRESH_DEBOUNCE_MS:-150}"
export OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS="${OPENCLAW_STATUS_REFRESH_MIN_INTERVAL_MS:-1000}"
unset OPENCLAW_STATIC_ROOT

cd "$ROOT"

if [[ -f "$PIDFILE" ]]; then
  old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "frontend dev already running: pid=$old_pid"
    exit 0
  fi
fi

nohup npm run start >>"$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "started frontend dev pid=$(cat "$PIDFILE") port=$PORT log=$LOG"
