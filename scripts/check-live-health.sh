#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://www.wangyuye.online/pokemon-claw}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass() { printf '[PASS] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*"; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

need_cmd curl
need_cmd node
need_cmd jq

check_json() {
  local path="$1"
  local jq_expr="$2"
  local out="$TMP_DIR/$(echo "$path" | tr '/' '_').json"
  curl -fsS "$BASE_URL$path" > "$out" || fail "$path unreachable"
  jq -e "$jq_expr" "$out" >/dev/null || fail "$path payload check failed"
  pass "$path ok"
}

check_json "/api/openclaw/status" '.zone and .mode and .alertLevel and ._meta.wsPath'
check_json "/api/tasks/stats" '.data | has("total") and has("doing") and has("blocked")'
check_json "/api/tasks/runtime" '.data.queueSummary | has("queued") and has("running") and has("failed")'
check_json "/api/openclaw/diagnostics" '.ok == true and .data.ws.path and (.data.stream.hasPayload == true)'

node - <<'NODE' "$BASE_URL"
const https = require('https');
const crypto = require('crypto');
const base = new URL(process.argv[2]);
const key = crypto.randomBytes(16).toString('base64');
const req = https.request({
  hostname: base.hostname,
  port: base.port || 443,
  path: `${base.pathname.replace(/\/$/, '')}/ws/openclaw/status`,
  headers: {
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': key,
    Origin: base.origin,
  },
}, (res) => {
  console.error(`[FAIL] websocket returned HTTP ${res.statusCode}`);
  process.exit(1);
});
req.on('upgrade', (res, socket) => {
  console.log('[PASS] websocket handshake ok');
  socket.once('data', () => {
    console.log('[PASS] websocket first frame received');
    socket.end();
    process.exit(0);
  });
  socket.setTimeout(8000, () => {
    console.error('[FAIL] websocket frame timeout');
    socket.destroy();
    process.exit(1);
  });
});
req.on('error', (err) => {
  console.error(`[FAIL] websocket error: ${err.message}`);
  process.exit(1);
});
req.end();
NODE

printf '\nCurrent summary:\n'
curl -fsS "$BASE_URL/api/openclaw/status" | jq '{zone, mode, alertLevel, wsPath: ._meta.wsPath}'
curl -fsS "$BASE_URL/api/tasks/runtime" | jq '.data.queueSummary'
