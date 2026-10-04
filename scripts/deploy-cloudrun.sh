#!/usr/bin/env bash
# Deploy Cite API to Google Cloud Run
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-cite-api}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "Set a project first:"
  echo "  gcloud auth login"
  echo "  gcloud projects create cite-api-\$USER --name='Cite API'   # or pick an existing one"
  echo "  gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Project=$PROJECT Region=$REGION Service=$SERVICE"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT"

# One-shot source deploy (Cloud Build builds the Dockerfile)
gcloud run deploy "$SERVICE" \
  --source="$ROOT" \
  --region="$REGION" \
  --project="$PROJECT" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="NODE_ENV=production"

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(status.url)')"
echo ""
echo "API URL: $URL"
echo "Health:  curl -sS $URL/health"
echo ""
echo "Point the Vercel UI at it:"
echo "  cd frontend && vercel env add VITE_API_URL production"
echo "  # paste: $URL"
echo "  vercel --prod"