# Deploy Cite

**UI → Vercel** · **API → Render** (Docker) · optional **Fly.io** if you have billing

The frontend is display-only. Set `VITE_API_URL` to the API URL so Lookup/Change Radar hit live coverage.

## 1. Backend (Render — recommended free path)

1. Push this repo to GitHub (if it isn’t already).
2. Open [Render Dashboard → New → Blueprint](https://dashboard.render.com/select-repo?type=blueprint).
3. Select the repo. It reads `render.yaml` and creates **cite-api**.
4. After deploy, copy the service URL (e.g. `https://cite-api.onrender.com`).
5. Optional env in Render: `CORS_ORIGIN=https://YOUR-APP.vercel.app`

Health check:

```bash
curl -sS https://cite-api.onrender.com/health
```

Free Render services sleep after idle; first request can take ~30–60s.

### Alternative: Fly.io

Needs a payment method on the Fly account (`flyctl auth login` then `flyctl deploy`). App name in `fly.toml`: `cite-api` → `https://cite-api.fly.dev`.

## 2. Frontend (Vercel)

```bash
cd frontend
vercel link --yes --project cite --scope biniyamlombe   # first time
vercel env add VITE_API_URL production
# paste: https://cite-api.onrender.com   (or your Fly URL)

vercel --prod
```

Build uses `NITRO_PRESET=vercel` (see `frontend/vercel.json`).

`*.vercel.app` and `*.onrender.com` are allowed in API CORS by default.

## 3. Smoke

```bash
curl -sS "$API/health"
curl -sS "$API/lookup/A0005?as_of=2026-10-01" | jq '.results|length'
# Open the Vercel URL → Connected badge → A0005 / SA0001 / Change Radar
```

## Offline fallback

If `VITE_API_URL` is unset, the UI uses corpus-backed snapshots (no live API). Good for a UI-only preview while the API is still deploying.
