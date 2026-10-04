#!/usr/bin/env bash
# Full quality gate: typecheck, lint, tests, schema, submission artifacts, change cases.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══ Cite quality gate ═══"
echo

echo "→ shared + backend typecheck / build"
npm run build -w shared
npm run build -w backend

echo "→ frontend typecheck"
npx tsc --noEmit -p frontend/tsconfig.json

echo "→ frontend lint (eslint + prettier)"
npm run lint --prefix frontend -- --quiet

echo "→ schema gate"
npm run check-schema

echo "→ backend + frontend tests (includes T1–T5)"
npm test

echo "→ submission artifact check"
SKIP_SMOKE=1 bash scripts/submission-check.sh

if [[ -f outputs/provenance.json ]]; then
  echo "  ✓ outputs/provenance.json present"
else
  echo "  · provenance.json missing — generating"
  npm run write-provenance -w backend
fi

echo
echo "Quality gate OK."
echo "Reminder: Cite is a legal-information prototype — not legal advice."
