#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://www.wangyuye.online/pokemon-claw}"
WS_URL="${BASE_URL/https:/wss:}/ws/openclaw/status"
LOCAL_BACKEND="${LOCAL_BACKEND:-http://127.0.0.1:8787}"
RUN_WRITE_CHECKS="${RUN_WRITE_CHECKS:-0}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass() { printf '[PASS] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*"; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

need_cmd curl
need_cmd node

HTTP_JSON="$TMP_DIR/status.json"
RUNTIME_JSON="$TMP_DIR/runtime.json"

curl -fsS "$BASE_URL/api/openclaw/status" > "$HTTP_JSON" || fail "public status endpoint unreachable"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!data.zone||!data.mode||!data.alertLevel||!data._meta){process.exit(1)}" "$HTTP_JSON" \
  && pass "HTTP status endpoint returns expected fields" \
  || fail "status payload missing required fields"

curl -fsS "$BASE_URL/api/tasks/runtime" > "$RUNTIME_JSON" || fail "public runtime endpoint unreachable"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!data.data||!data.data.queueSummary){process.exit(1)}" "$RUNTIME_JSON" \
  && pass "task runtime endpoint returns queue summary" \
  || fail "runtime payload missing queue summary"

node - <<'NODE' "$WS_URL"
const WebSocket = require('./frontend/node_modules/ws');
const url = process.argv[2];
const ws = new WebSocket(url);
let done = false;
function finish(code, msg) {
  if (done) return;
  done = true;
  console.log(msg);
  try { ws.close(); } catch {}
  process.exit(code);
}
ws.on('open', () => {});
ws.on('message', (buf) => {
  const text = String(buf || '');
  if (text.includes('"type":"hello"') || text.includes('"type":"status"')) {
    finish(0, `[PASS] websocket handshake ok: ${url}`);
  }
});
ws.on('unexpected-response', (_req, res) => finish(2, `[FAIL] websocket unexpected HTTP ${res.statusCode}: ${url}`));
ws.on('error', (err) => finish(3, `[FAIL] websocket error: ${err.message}`));
setTimeout(() => finish(4, `[FAIL] websocket timeout: ${url}`), 8000);
NODE

node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!Array.isArray(data.openclaw?.agents)){process.exit(1)}" "$HTTP_JSON" \
  && pass "agent panel data shape is valid" \
  || fail "agent panel data missing or invalid"

if [[ "$RUN_WRITE_CHECKS" != "1" ]]; then
  warn "write-path checks skipped. Run with RUN_WRITE_CHECKS=1 to verify debug state, retry/resolve, and agent turn."
  exit 0
fi

curl -fsS -X POST "$LOCAL_BACKEND/api/debug/state" -H 'content-type: application/json' -d '{"zone":"alarm"}' > "$TMP_DIR/alarm.json" \
  && pass "local backend debug alarm injected" \
  || fail "failed to inject local debug alarm"

sleep 1
curl -fsS "$BASE_URL/api/openclaw/status" > "$TMP_DIR/public-alarm.json" || fail "failed to read public status after alarm"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const actions=data.openclaw?.runtime?.currentTask?.availableActions||[]; if(data.zone!=='alarm'||data.mode!=='RUNNING'||!actions.includes('retry')||!actions.includes('resolve')){process.exit(1)}" "$TMP_DIR/public-alarm.json" \
  && pass "public alarm state/action visibility verified" \
  || fail "public alarm state mismatch"

curl -fsS -X POST "$BASE_URL/api/tasks/debug-alarm-task/retry" -H 'content-type: application/json' -d '{}' > "$TMP_DIR/retry.json" || fail "retry action failed"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(data.ok!==true||data.data?.action!=='retry'||data.data?.runtime?.currentTask?.status!=='running'){process.exit(1)}" "$TMP_DIR/retry.json" \
  && pass "retry action verified" \
  || fail "retry response mismatch"

curl -fsS -X POST "$BASE_URL/api/tasks/debug-alarm-task/resolve" -H 'content-type: application/json' -d '{}' > "$TMP_DIR/resolve.json" || fail "resolve action failed"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(data.ok!==true||data.data?.action!=='resolve'||data.data?.runtime?.currentTask!==null){process.exit(1)}" "$TMP_DIR/resolve.json" \
  && pass "resolve action verified" \
  || fail "resolve response mismatch"

curl -fsS -X POST "$BASE_URL/api/openclaw/agent/turn" -H 'content-type: application/json' -d '{"agent":"ops","message":"[acceptance] 连通性验收消息，可忽略"}' > "$TMP_DIR/agent-turn.json" || fail "agent turn failed"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(data.ok!==true||data.data?.status!=='ok'){process.exit(1)}" "$TMP_DIR/agent-turn.json" \
  && pass "agent turn verified" \
  || fail "agent turn response mismatch"

curl -fsS -X POST "$LOCAL_BACKEND/api/debug/state" -H 'content-type: application/json' -d '{"zone":"clear"}' >/dev/null || warn "failed to clear debug state"
pass "write-path checks completed and debug state cleared"