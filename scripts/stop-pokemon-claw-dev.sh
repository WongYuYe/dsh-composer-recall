#!/usr/bin/env bash
set -euo pipefail

PIDFILE="/tmp/pokemon-claw-frontend-dev.pid"

if [[ ! -f "$PIDFILE" ]]; then
  echo "pidfile not found; nothing to stop"
  exit 0
fi

pid="$(cat "$PIDFILE" 2>/dev/null || true)"
if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid" || true
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" || true
  fi
  echo "stopped pid=$pid"
else
  echo "process already stopped"
fi

rm -f "$PIDFILE"
