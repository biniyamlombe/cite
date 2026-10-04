# Deploy Cite

**UI → Vercel** · **API → Render** (Docker) · optional **Fly.io** if you have billing

The frontend is display-only. Set `VITE_API_URL` to the API URL so Lookup/Change Radar hit live coverage.

## 1. Backend (Render — free Node web service)

Repo: [`biniyamlombe/cite`](https://github.com/biniyamlombe/cite) (`render.yaml` at root).

### One-time in the dashboard

1. Open [New → Blueprint](https://dashboard.render.com/select-repo?type=blueprint) (or **New → Web Service**).
2. Connect GitHub and select **`biniyamlombe/cite`**, branch `main`.
3. Blueprint reads `render.yaml` and creates **cite-api** (free Node).
   - Or manual Web Service settings:
     - **Runtime:** Node
     - **Build:** `npm ci && npm run build -w shared`
     - **Start:** `npm run start -w backend`
     - **Health check path:** `/health`
     - **Plan:** Free
4. Deploy → copy URL (e.g. `https://cite-api.onrender.com`).
5. Optional env: `CORS_ORIGIN=https://YOUR-APP.vercel.app`

```bash
curl -sS https://cite-api.onrender.com/health
curl -sS "https://cite-api.onrender.com/lookup/A0005?as_of=2026-10-01" | head -c 200
```

Free services sleep after ~15 min idle; first hit can take 30–60s. A `Dockerfile` remains for paid Docker / Fly if you prefer.

### Alternative: Fly.io

Needs a payment method (`flyctl deploy`). App name in `fly.toml`: `cite-api`.

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
