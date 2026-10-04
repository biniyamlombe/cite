#!/usr/bin/env bash
# Expose local Cite API (:4000) via Cloudflare quick tunnel for Lovable cloud.
set -euo pipefail

API_PORT="${PORT:-4000}"
if ! curl -sS -m 2 "http://localhost:${API_PORT}/health" | grep -q '"ok":true'; then
  echo "Backend not healthy on :${API_PORT}. Start it first: npm run dev:backend"
  exit 1
fi

echo "Starting Cloudflare tunnel → http://localhost:${API_PORT}"
echo "When the https://….trycloudflare.com URL appears, set Lovable env:"
echo "  VITE_API_URL=https://YOUR-TUNNEL.trycloudflare.com"
echo "(Quick tunnels get a new URL every restart.)"
echo

exec npx --yes cloudflared tunnel --url "http://localhost:${API_PORT}"
