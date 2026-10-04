#!/usr/bin/env bash
# Build organizer upload zip after submission:check passes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/submission-check.sh

STAMP="$(date -u +%Y%m%dT%H%MZ)"
OUT_DIR="$ROOT/dist"
ZIP_NAME="cite-submission-${STAMP}.zip"
STAGE="$OUT_DIR/cite-submission-stage"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$OUT_DIR"

cp outputs/rules.json outputs/lookups.json outputs/changes.json "$STAGE/"
# Organizer zip keeps classic names; repo docs use clearer filenames.
cp docs/method-note.md "$STAGE/METHOD.md"
cp docs/demo-script.md "$STAGE/DEMO.md"

(
  cd "$STAGE"
  zip -q "$OUT_DIR/$ZIP_NAME" rules.json lookups.json changes.json METHOD.md DEMO.md
)

# Stable pointer for the latest pack
ln -sfn "$ZIP_NAME" "$OUT_DIR/cite-submission-latest.zip"

rm -rf "$STAGE"

echo
echo "Packed → dist/$ZIP_NAME"
echo "Also → dist/cite-submission-latest.zip"
unzip -l "$OUT_DIR/$ZIP_NAME"
