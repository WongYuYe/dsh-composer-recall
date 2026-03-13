#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend"
BASE_URL="${BASE_URL:-https://www.wangyuye.online/pokemon-claw}"
CHECK_SCRIPT="$ROOT/scripts/check-live-health.sh"

step() { printf '\n==> %s\n' "$*"; }
fail() { printf '\n[FAIL] %s\n' "$*"; exit 1; }

command -v npm >/dev/null 2>&1 || fail "npm not found"
command -v curl >/dev/null 2>&1 || fail "curl not found"
command -v jq >/dev/null 2>&1 || fail "jq not found"

step "install frontend dependencies"
cd "$FRONTEND_DIR"
npm install

step "build frontend dist"
npm run build

test -f "$FRONTEND_DIR/dist/index.html" || fail "dist/index.html missing after build"

step "restart frontend prod service"
bash "$ROOT/scripts/stop-frontend-prod.sh" || true
bash "$ROOT/scripts/run-frontend-prod.sh"

step "wait for local diagnostics"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3008/api/openclaw/diagnostics >/tmp/open-pokemon-diagnostics.json 2>/dev/null; then
    jq -e '.ok == true' /tmp/open-pokemon-diagnostics.json >/dev/null && break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:3008/api/openclaw/diagnostics | jq '{ok, wsPath: .data.ws.path, hasPayload: .data.stream.hasPayload}'

step "run public live health check"
bash "$CHECK_SCRIPT" "$BASE_URL"

printf '\n[DONE] frontend production deploy + health check passed\n'
