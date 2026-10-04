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
if [[ -f outputs/provenance.json ]]; then ok "outputs/provenance.json present"; else
  echo "  · provenance.json missing (run npm run write-provenance)"
fi

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

expect = {"T1": 250, "T2": 90, "T3": 140, "T4": 110, "T5": 0}
shape_ok = True
for tid, n_exp in expect.items():
    if tid not in changes:
        errors.append(f"{tid} missing from changes.json")
        shape_ok = False
        continue
    n = len(changes[tid].get("affected_address_ids", []))
    if n != n_exp:
        errors.append(f"{tid} affected={n}, expected {n_exp}")
        shape_ok = False
if "T3" in changes:
    conflicts = len(changes["T3"].get("conflict_flag_address_ids") or [])
    if conflicts != 90:
        errors.append(f"T3 conflicts={conflicts}, expected 90")
        shape_ok = False
if shape_ok:
    print("  ✓ changes.json T1–T5 (250/90/140+90c/110/0)")
if "T6" in changes:
    # Hour-16 / T6 was removed from participant-final-no-hour16 — prefer absence.
    t6 = changes["T6"]
    notes = (t6.get("notes") or "").lower()
    if t6.get("affected_address_ids"):
        errors.append("T6 has affected addresses but pack has no T6 test (no-hour16)")
    elif not (t6.get("notes") or "").strip():
        errors.append("T6 present but notes empty")
    else:
        print("  · T6 note present (prefer omitting T6 for no-hour16 pack)")
else:
    print("  ✓ T6 absent (correct for participant-final-no-hour16)")

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

# Enrichment fields (optional; pack graders ignore unknown keys)
sample_id = next(iter(lookups["lookups"]))
sample_row = lookups["lookups"][sample_id][0]
for key in ("applicability", "facts_used", "needs_human_review"):
    if key not in sample_row:
        errors.append(f"lookups enrichment missing '{key}' — re-run npm run lookup")
        break
else:
    print("  ✓ lookup enrichment fields present (applicability / facts / review)")

if Path("outputs/provenance.json").exists():
    prov = json.loads(Path("outputs/provenance.json").read_text())
    if not prov.get("schema_version") or not prov.get("pipeline_version"):
        errors.append("provenance.json missing schema_version/pipeline_version")
    else:
        print(f"  ✓ provenance schema_version={prov.get('schema_version')} pipeline={prov.get('pipeline_version')}")

fips_ok = sum(1 for g in geo if g.get("county_fips") and g.get("place_geoid"))
if fips_ok < 500:
    errors.append(f"geocode FIPS/GEOID incomplete: {fips_ok}/500 — run npm run enrich-geocode-ids")
else:
    print("  ✓ geocode_cache county_fips + place_geoid for 500 addresses")

ev_ok = all(
    isinstance(changes[tid].get("evidence_summary"), str) and changes[tid].get("sample_evidence")
    for tid in ("T1", "T2", "T3", "T4", "T5")
)
if not ev_ok:
    errors.append("changes.json missing evidence_summary/sample_evidence — re-run npm run changes")
else:
    print("  ✓ changes.json evidence summaries for T1–T5")

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

if [[ "${SKIP_SMOKE:-}" == "1" ]]; then
  echo "Skipping smoke tests (SKIP_SMOKE=1)."
else
  echo "Running smoke tests…"
  npm test
fi
echo
echo "Submission check OK — upload outputs/rules.json, lookups.json, changes.json (+ docs/method-note.md / docs/demo-script.md as required)."
