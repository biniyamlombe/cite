#!/usr/bin/env bash
# Validate organizer submission artifacts before upload / demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0
ok() { printf '  ✓ %s\n' "$*"; }
bad() { printf '  ✗ %s\n' "$*"; FAIL=1; }

echo "Cite submission check"
echo

for f in outputs/rules.json outputs/lookups.json outputs/changes.json outputs/geocode_cache.json; do
  if [[ -f "$f" ]]; then ok "$f present"; else bad "$f missing"; fi
done

if ! python3 - <<'PY'
import json, sys
from pathlib import Path

root = Path(".")
errors = []

rules = json.loads((root / "outputs/rules.json").read_text())["rules"]
lookups = json.loads((root / "outputs/lookups.json").read_text())
changes = json.loads((root / "outputs/changes.json").read_text())
geo = json.loads((root / "outputs/geocode_cache.json").read_text())["geocoded"]

need_alias = {"CA-ALG-01", "HOB-ALG-01", "JC-ALG-01", "NJ-ALG-01", "MA-ALG-P1", "MA-ALG-P2", "MA-RENT-P1"}
have_alias = {r.get("alias_id") for r in rules if r.get("alias_id")}
missing = sorted(need_alias - have_alias)
if missing:
    errors.append(f"missing aliases: {missing}")
else:
    print("  ✓ change-test aliases present")

cats = set(r["category"] for r in rules)
if len(cats) < 6:
    errors.append(f"expected 6 categories, got {sorted(cats)}")
else:
    print(f"  ✓ {len(rules)} rules across 6 categories")

if lookups.get("as_of") != "2026-10-01":
    errors.append(f"lookups as_of={lookups.get('as_of')}")
else:
    print("  ✓ lookups as_of=2026-10-01")

n = len(lookups.get("lookups") or {})
if n != 500:
    errors.append(f"lookups cover {n} addresses, expected 500")
else:
    print("  ✓ lookups cover 500 addresses")

empty = [aid for aid, rows in lookups["lookups"].items() if not rows]
if empty:
    errors.append(f"{len(empty)} empty lookups")
else:
    print("  ✓ no empty lookup rows")

if len(geo) != 500:
    errors.append(f"geocode_cache has {len(geo)}, expected 500")
else:
    print("  ✓ geocode_cache has 500 rows")

shape_ok = True
for tid in ["T1", "T2", "T3", "T4", "T5"]:
    if tid not in changes:
        errors.append(f"{tid} missing from changes.json")
        shape_ok = False
if "T1" in changes and len(changes["T1"].get("affected_address_ids", [])) != 250:
    errors.append(f"T1 affected={len(changes['T1'].get('affected_address_ids', []))}, expected 250")
    shape_ok = False
if "T5" in changes and len(changes["T5"].get("affected_address_ids", [])) != 0:
    errors.append("T5 affected set must be empty")
    shape_ok = False
if shape_ok and all(t in changes for t in ["T1", "T2", "T3", "T4", "T5"]):
    print("  ✓ changes.json T1–T5 shape (T1=250, T5=0)")
if "T6" in changes:
    print("  ✓ T6 placeholder present (honest hour-16 stub)")

text = {p.stem: p.read_text() for p in (root / "data/pack/corpus/text").glob("*.txt")}
bad_span = 0
for r in rules:
    doc = text.get(r.get("source_doc_id") or "")
    span = r.get("quoted_span") or ""
    if not doc or span not in doc:
        bad_span += 1
if bad_span:
    errors.append(f"{bad_span} rules fail exact quoted_span")
else:
    print("  ✓ all quoted_spans exact in corpus")

if errors:
    for e in errors:
        print(f"  ✗ {e}")
    sys.exit(1)
PY
then
  FAIL=1
fi

echo
if [[ "$FAIL" -ne 0 ]]; then
  echo "Submission check FAILED."
  exit 1
fi

echo "Running smoke tests…"
npm test
echo
echo "Submission check OK — upload outputs/rules.json, lookups.json, changes.json (+ docs/METHOD.md / docs/DEMO.md as required)."
