#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[x] openclaw CLI not found. Please install OpenClaw first."
  echo "    Docs: https://docs.openclaw.ai"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[+] Created .env from .env.example"
fi

if ! grep -q '^API_KEY=' .env || grep -q '^API_KEY=$' .env; then
  API_KEY_VALUE="$(openssl rand -hex 32)"
  if grep -q '^API_KEY=' .env; then
    sed -i.bak "s|^API_KEY=.*|API_KEY=${API_KEY_VALUE}|" .env && rm -f .env.bak
  else
    printf "\nAPI_KEY=%s\n" "$API_KEY_VALUE" >> .env
  fi
  echo "[+] Generated API_KEY in .env"
else
  echo "[i] API_KEY already exists in .env"
fi

if ! grep -q '^OPENCLAW_BIN=' .env || grep -q '^OPENCLAW_BIN=$' .env; then
  if grep -q '^OPENCLAW_BIN=' .env; then
    sed -i.bak 's|^OPENCLAW_BIN=.*|OPENCLAW_BIN=openclaw|' .env && rm -f .env.bak
  else
    printf "\nOPENCLAW_BIN=openclaw\n" >> .env
  fi
fi

if [ ! -d node_modules ]; then
  npm install
fi

echo "[+] Running OpenClaw connectivity check..."
if ! openclaw health --json >/dev/null 2>&1; then
  echo "[!] OpenClaw health check failed. Ensure gateway/agent is set up on this machine."
  echo "    Try: openclaw status"
  exit 1
fi

echo "[✓] Ready. Start API server with: npm run dev"
echo "[i] API test: curl -H \"x-api-key: $(grep '^API_KEY=' .env | cut -d'=' -f2)\" http://127.0.0.1:8787/api/openclaw/health"
