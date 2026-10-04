# Cite — Method note

**Team / product:** Cite (Hack-Nation × RealPage · Challenge 02)  
**Default as-of date:** `2026-10-01`  
**Disclaimer:** Not legal advice.

## What we built

An automated pipeline that (A) extracts structured housing rules from the pack corpus, (B) geocodes sample addresses and evaluates coverage, and (C) runs the five supplied change tests. Answers cite exact corpus spans and show an as-of date.

## Pipeline (reproducible)

```bash
npm run pipeline          # schema → extract → enrich → geocode → lookup → changes → provenance
# or with offline geocode: npm run pipeline -- --heuristic-geo
npm test                  # smoke suite (schema, citations, aliases, T1–T5)
npm run quality           # typecheck + substantive lint + tests + submission check
```

Outputs: `outputs/rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json`, `provenance.json`, `audit_log.jsonl`, plus companions `plain_language.json`, `no_rule_findings.json`, `selfcheck.txt`.  
Lookup rows include pack `result` plus enrichment (`applicability`, `facts_used` / `facts_missing`, `needs_human_review`) and optional EN/ES headlines from `plain_language.json`. Pack-shaped submission files remain grader-compatible.  
API `GET /lookup/:id?include_non_applicable=1` also returns explicit `does_not_apply` rows. Jurisdiction stack includes `county_fips` / `place_geoid` when trusted. Change results include `evidence_summary`, `sample_evidence`, and optional per-address status.

| Step | Module | What runs |
|------|--------|-----------|
| Schema gate | — | Zod + Ajv on pack sample / rule schema |
| Extract | **A** | Claude (default `claude-haiku-4-5`) over capturable docs; heuristic fallback if no API key; `quoted_span` must appear verbatim in source |
| Enrich | A/B | Dual `coverage_conditions`; then `enrich-fields` for `penalty`, `retrieved_at`, exemptions, effective dates |
| Geocode | **B** | Census Geocoder (or heuristic) → state / county / legal city (postal city ≠ legal city) |
| Lookup | **B** | For each of 500 addresses: `applies` / `unknown` / `superseded` / `not_yet_effective` / `pending`; pack §9 open questions appended on matching rules |
| Changes | **C** | T1–T5 from `dev/change_tests.json` → affected (+ conflict) address sets (no T6; hour-16 removed from pack) |

Live demo: Hono API (`:4000`) + Vite UI (`VITE_API_URL`). UI is display-only; no legal logic in the frontend.

Renter tools (API-grounded): `POST /check` (rent-increase verdict from applying caps), `POST /ask` (question answered only from retrieved rules; evasion refused), `POST /letter` (fixed template from check facts). Portfolio watchlist surfaces approaching pending/NTE effective dates and horizon result diffs from lookup responses only.

## Design choices

- **Automated extraction.** Rules come from the corpus via the extract agent, not hand transcription. JSON repair + quote-retry keep spans exact.
- **Unknown over guessing.** Missing year/units/owner can yield `unknown` when predicates require them (e.g. Berkeley / Boston assessor gaps).
- **Layering.** Confirmed local rent coverage can `supersede` statewide caps; unresolved local coverage cannot establish supersession; conflict flags mark NJ FAIR vs Hoboken/Jersey City overlaps for human review.
- **Change-test aliases.** Stable IDs `CA-ALG-01`, `NJ-ALG-01`, `MA-ALG-P1/P2`, `MA-RENT-P1`, `HOB-ALG-01`, `JC-ALG-01` for T1–T5.
- **Link-only cities.** Hoboken / Jersey City algorithmic ordinance pages are link-only in the pack (`links_only.csv`: ecode360 / news). We **upsert** `HOB-ALG-01` / `JC-ALG-01` every enrich with low confidence, conflict flags, the primary link-only URLs in `conflict_note`, and a **verbatim NJ FAIR Act (D069) quote** — never invented municipal code — so T2/T3 retain deterministic scenario membership. Live applicability remains `unknown`, the municipal effective date is unset, and the API labels these records `scenario_only`; the organizer-compatible status is a scenario assumption, not a verified ordinance status.
- **Soft-gap screening.** Thin capturable pages D029 / D078 yield `CAM-FH-01` / `SF-FC-01` from verbatim FAQ/summary sentences. Newark check-terms pages (D070–D072) stay uncaptured; Lookup exposes `corpus_gaps` instead of inventing city rules. Companion `no_rule_findings.json` lists empty jurisdiction×category cells for Sources/Rules.
- **Version history.** `GET /rules/:id/versions` reads `outputs/rule_versions.json`, keyed by alias/source so renumbered `team_rule_id`s still resolve. Built from git snapshots of `rules.json` plus the current tip.
- **Effective-date grounding.** Every dated rule carries `effective_date_basis` (`stated` / `derived` / `rule_of_law` / `not_stated`). A date must appear in the source, be computed from the source's own clause (e.g. NJ FAIR D069: "approved July 20, 2026" + "first day of the twelfth month next following … enactment" = 2027-07-01), or follow a cited default rule (Cal. Const. art. IV §8(c)(1): non-urgency statutes take effect Jan 1). Unsupported dates are removed rather than kept. Status is repaired from the grounded date, and lookups evaluate `legal_status_at_as_of_date` per request, so `NJ-ALG-01` (r-0091, the extracted D069 rule, not a synthetic copy) is `not_yet_effective` before 2027-07-01 and `in_force` after. Covered by `backend/src/tests/temporal_grounding.test.ts`.
- **Scaffold status honesty.** `HOB-ALG-01` / `JC-ALG-01` carry `status_basis: "unverified: …"`; lookups return `unknown` without a legal status for them.
- **Stretch jurisdiction.** Santa Ana corpus docs (D084/D085) already extract; we add six demo addresses and run the same geocode/coverage path (`npm run stretch`) so lookups apply city + CA state rules without touching T1–T5.
- **Auditability.** `outputs/audit_log.jsonl` and `GET /audit` record extract / quote / test / ask events.
- **Offline selfcheck.** `npm run selfcheck` writes `outputs/selfcheck.txt` (verbatim spans, T1–T5 counts, dual coverage honesty).

## Current submission snapshot

- **145** rules across the six required categories; all change-test aliases present  
- Soft-gap scaffolds: `CAM-FH-01` (D029 Cambridge Fair Housing / source of income) and `SF-FC-01` (D078 Fair Chance one-liner, low confidence)  
- Lookups for all **500** addresses at `as_of=2026-10-01`  
- T1–T5 green (`T1=250`, `T2=90`, `T3=140` +90 conflicts, `T4=110`, `T5=0`); no T6 (participant-final-no-hour16)  
- Verify before upload: `npm run quality` or `npm run submission:check` · pack: `npm run submission:pack`  
- Audit evidence: `docs/audit-report.md`, `docs/gap-register.md`, `docs/system-architecture.md`

## Limits (honest)

- Default extract uses Haiku; empty-cache docs and `npm run extract -- --retry-failed` upgrade once with Sonnet (`ANTHROPIC_RETRY_MODEL`).  
- Thin capturable pages: D029/D078 now yield `screening_restrictions` scaffolds from verbatim FAQ/summary sentences (not full ordinance bodies).  
- Newark local pages (D070–D072) stay check-terms with **no** invented city rules; Lookup returns `corpus_gaps` for uncaptured local documents even when other city rules exist.
- Quote snapping folds curly apostrophes/dashes so model spans match corpus bytes.  
- Rule version history is rebuilt from git snapshots of `rules.json` (`npm run build-versions` → `outputs/rule_versions.json`).  
- Stretch: Santa Ana uses the same pipeline via `data/stretch/santa_ana_addresses.csv` + `npm run stretch` (pack’s 500 change-test addresses unchanged); Lookup shows a Stretch badge + demo tip for SA* IDs.  
- Confidence bands (high ≥0.85 / medium / low <0.5) filter on Rules; Spanish locale covers primary-nav chrome only.  
- UI surfaces pack §9 open questions as distinct callouts.  
- Link-only primary pages (HOB/JC) show an explicit honesty banner: quotes stay on capturable corpus text; no invented municipal code.  
- Sticky disclaimer: not legal advice and not a compliance certification; About lists pack §8 commitments + §9 open questions.  
- This is a prototype, not counsel-reviewed advice.

## Reliability checks

- Strict calendar dates reject rollover/impossible values. Santa Ana rolling-year guards use the requested as-of year; boundary-year facts remain unknown.
- Live extraction, including heuristic fallback, validates schema and exact quotes before return; Pipeline reports those checks against the full source document.
- JSON files publish by atomic rename; corrupt artifacts raise errors instead of looking absent. Extraction cache identity includes prompt, model, and validator version. API responses carry stable identity for result comparisons.
- Corpus-backed offline snapshots are generated by `npm run demo:snapshots`. They never manufacture building facts, quotations, or version history.
- `npm test` includes backend regression and frontend behavioral tests; `npm run typecheck` checks shared/backend/frontend contracts. The pipeline still uses per-artifact publication, so refresh the complete output set and snapshots together after extraction; this is not a transactional database.
