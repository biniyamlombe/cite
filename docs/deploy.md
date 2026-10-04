# Deploy Cite

**UI → Vercel** · **API → Google Cloud Run**

The frontend is display-only. Set `VITE_API_URL` to the Cloud Run URL so Lookup/Change Radar hit live coverage.

**Current production**

| | URL |
|---|---|
| UI | https://cite-eight.vercel.app |
| API | https://cite-api-olep35ee2q-uc.a.run.app |
| GCP project | `cite-api-biniyamlombe` · service `cite-api` · region `us-central1` |

## 1. Backend (Google Cloud Run)

Prereqs: [gcloud CLI](https://cloud.google.com/sdk/docs/install) (Homebrew: `brew install --cask gcloud-cli`).

```bash
# One-time auth + project
gcloud auth login
gcloud projects create cite-api-YOURNICK --name="Cite API"   # or reuse an existing project
gcloud config set project YOUR_PROJECT_ID
gcloud billing projects link YOUR_PROJECT_ID --billing-account=ACCOUNT_ID  # free tier still needs billing linked

# Deploy (builds Dockerfile via Cloud Build)
bash scripts/deploy-cloudrun.sh
```

Defaults: service `cite-api`, region `us-central1`, 512Mi, scale-to-zero.

```bash
# Override if needed
GCP_PROJECT=my-project GCP_REGION=us-east1 bash scripts/deploy-cloudrun.sh

curl -sS https://cite-api-xxxxx-uc.a.run.app/health
```

Optional env after the Vercel URL exists:

```bash
gcloud run services update cite-api \
  --region=us-central1 \
  --set-env-vars="NODE_ENV=production,CORS_ORIGIN=https://YOUR-APP.vercel.app"
```

`*.vercel.app` and `*.run.app` are allowed in API CORS by default.

**Billing note:** Cloud Run has a generous free tier, but Google usually requires a billing account linked to the project (you won’t be charged if you stay in free limits).

## 2. Frontend (Vercel)

```bash
cd frontend
vercel link --yes --project cite
vercel env add VITE_API_URL production
# paste the Cloud Run URL from step 1

vercel --prod
```

## 3. Smoke

```bash
API=https://cite-api-xxxxx-uc.a.run.app
curl -sS "$API/health"
curl -sS "$API/lookup/A0005?as_of=2026-10-01" | head -c 200
# Open the Vercel URL → Connected badge → A0005 / SA0001 / Change Radar
```

## Offline fallback

If `VITE_API_URL` is unset, the UI uses corpus-backed snapshots (no live API).

## Other API hosts (optional)

- **Render** — `render.yaml` free Node service
- **Fly.io** — `Dockerfile` + `fly.toml` (billing required on this account)
