#!/usr/bin/env bash
# Quick health check before a judge demo. Exit 0 only if critical paths work.
set -euo pipefail

API="${VITE_API_URL:-${API_URL:-http://localhost:4000}}"
API="${API%/}"
FAIL=0

ok() { printf '  ✓ %s\n' "$*"; }
bad() { printf '  ✗ %s\n' "$*"; FAIL=1; }

echo "Cite demo preflight"
echo "API base: $API"
echo

# /health
if body=$(curl -sS -m 5 "$API/health" 2>/dev/null) && echo "$body" | grep -q '"ok":true'; then
  ok "GET /health"
else
  bad "GET /health (is npm run dev:backend running?)"
fi

# Demo lookups
for id in A0005 A0065 A0002 SA0001; do
  code=$(curl -sS -m 8 -o /tmp/cite-preflight.json -w '%{http_code}' \
    "$API/lookup/$id?as_of=2026-10-01" 2>/dev/null || echo 000)
  if [[ "$code" == "200" ]] && grep -q '"results"' /tmp/cite-preflight.json 2>/dev/null; then
    n=$(python3 -c 'import json;print(len(json.load(open("/tmp/cite-preflight.json")).get("results",[])))' 2>/dev/null || echo '?')
    ok "GET /lookup/$id ($n results)"
  else
    bad "GET /lookup/$id (HTTP $code)"
  fi
done

# Changes + T6 placeholder
code=$(curl -sS -m 8 -o /tmp/cite-preflight-changes.json -w '%{http_code}' \
  "$API/changes" 2>/dev/null || echo 000)
if [[ "$code" == "200" ]] && grep -q '"T1"' /tmp/cite-preflight-changes.json 2>/dev/null; then
  ok "GET /changes (T1–T5 present)"
  if grep -q '"T6"' /tmp/cite-preflight-changes.json 2>/dev/null; then
    ok "T6 placeholder present"
  else
    bad "T6 missing from /changes"
  fi
else
  bad "GET /changes (HTTP $code)"
fi

# Optional local UI
if curl -sS -m 2 -o /dev/null http://localhost:8080/ 2>/dev/null; then
  ok "UI http://localhost:8080"
elif curl -sS -m 2 -o /dev/null http://localhost:5173/ 2>/dev/null; then
  ok "UI http://localhost:5173"
else
  printf '  · UI not detected on :8080/:5173 (start with npm run dev:frontend)\n'
fi

echo
if [[ "$FAIL" -ne 0 ]]; then
  echo "Preflight FAILED — fix the ✗ items before pitching."
  exit 1
fi
echo "Preflight OK — ready for docs/DEMO.md walkthrough."
echo "Local UI env: frontend/.env.local → VITE_API_URL=http://localhost:4000"
echo "Lovable cloud: set VITE_API_URL to your Cloudflare tunnel URL (npm run demo:tunnel)."
