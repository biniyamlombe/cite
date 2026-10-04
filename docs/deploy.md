# Deploy Cite

**UI → Vercel** · **API → Fly.io**

The frontend is display-only. Set `VITE_API_URL` to the Fly API so Lookup/Change Radar hit live coverage.

## 1. Backend (Fly.io)

Prereqs: [flyctl](https://fly.io/docs/flyctl/install/) logged in (`flyctl auth login`).

```bash
# From repo root (first time)
flyctl apps create cite-api --org personal   # or your org
flyctl deploy

# Health check
curl -sS https://cite-api.fly.dev/health | jq .
```

Optional secrets:

```bash
flyctl secrets set CORS_ORIGIN=https://YOUR-APP.vercel.app
# ANTHROPIC_API_KEY only needed if you re-run extract on the server
```

`*.vercel.app` preview hosts are allowed in CORS by default.

## 2. Frontend (Vercel)

Prereqs: [Vercel CLI](https://vercel.com/docs/cli) logged in (`vercel login`).

```bash
cd frontend
vercel link --yes --project cite --scope biniyamlombe   # first time
vercel env add VITE_API_URL production
# value: https://cite-api.fly.dev

vercel --prod
```

Build uses `NITRO_PRESET=vercel` (see `frontend/vercel.json`).

## 3. Smoke

```bash
curl -sS https://cite-api.fly.dev/health
curl -sS "https://cite-api.fly.dev/lookup/A0005?as_of=2026-10-01" | jq '.results|length'
# Open the Vercel URL → Connected badge → A0005 / SA0001 / Change Radar
```

## Offline fallback

If `VITE_API_URL` is unset, the UI uses corpus-backed snapshots (no live API).
