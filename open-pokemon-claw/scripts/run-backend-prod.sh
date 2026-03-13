#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../backend" && pwd)"
LOG="/tmp/open-pokemon-backend-prod.log"
PIDFILE="/tmp/open-pokemon-backend-prod.pid"

cd "$ROOT"

if [[ -f "$PIDFILE" ]]; then
  old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "backend already running: pid=$old_pid"
    exit 0
  fi
fi

nohup npm run start >>"$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "started backend prod pid=$(cat "$PIDFILE") log=$LOG"
