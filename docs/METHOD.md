# Cite — Method note

**Team / product:** Cite (Hack-Nation × RealPage · Challenge 02)  
**Default as-of date:** `2026-10-01`  
**Disclaimer:** Not legal advice.

## What we built

An automated pipeline that (A) extracts structured housing rules from the pack corpus, (B) geocodes sample addresses and evaluates coverage, and (C) runs the five supplied change tests. Answers cite exact corpus spans and show an as-of date.

## Pipeline (reproducible)

```bash
npm run pipeline          # schema → extract → enrich → geocode → lookup → changes
# or with offline geocode: npm run pipeline -- --heuristic-geo
npm test                  # smoke suite (schema, citations, aliases, T1–T5)
```

Outputs: `outputs/rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json`, `audit_log.jsonl`.

| Step | Module | What runs |
|------|--------|-----------|
| Schema gate | — | Zod + Ajv on pack sample / rule schema |
| Extract | **A** | Claude (default `claude-haiku-4-5`) over capturable docs; heuristic fallback if no API key; `quoted_span` must appear verbatim in source |
| Enrich | A/B | Dual `coverage_conditions` (plain text + executable predicates) |
| Geocode | **B** | Census Geocoder (or heuristic) → state / county / legal city (postal city ≠ legal city) |
| Lookup | **B** | For each of 500 addresses: `applies` / `unknown` / `superseded` / `not_yet_effective` / `pending` |
| Changes | **C** | T1–T5 from `dev/change_tests.json` → affected (+ conflict) address sets |

Live demo: Hono API (`:4000`) + Vite UI (`VITE_API_URL`). UI is display-only; no legal logic in the frontend.

## Design choices

- **Automated extraction.** Rules come from the corpus via the extract agent, not hand transcription. JSON repair + quote-retry keep spans exact.
- **Unknown over guessing.** Missing year/units/owner can yield `unknown` when predicates require them (e.g. Berkeley / Boston assessor gaps).
- **Layering.** Local rent control can `supersede` statewide caps; conflict flags mark NJ FAIR vs Hoboken/Jersey City overlaps for human review.
- **Change-test aliases.** Stable IDs `CA-ALG-01`, `NJ-ALG-01`, `MA-ALG-P1/P2`, `MA-RENT-P1`, `HOB-ALG-01`, `JC-ALG-01` for T1–T5.
- **Link-only cities.** Hoboken / Jersey City algorithmic ordinance pages are link-only in the pack (`links_only.csv`: ecode360 / news). We **upsert** `HOB-ALG-01` / `JC-ALG-01` every enrich with low confidence, conflict flags, the primary link-only URLs in `conflict_note`, and a **verbatim NJ FAIR Act (D069) quote** — never invented municipal code — so T2/T3 stay deterministic and demo-honest.
- **Auditability.** `outputs/audit_log.jsonl` and `GET /audit` record extract / quote / test events.

## Current submission snapshot

- ~109 rules across the six required categories; all change-test aliases present  
- Lookups for all 500 addresses at `as_of=2026-10-01`  
- T1–T5 green in `npm test` (T5 affected set empty; no MA rent **cap**)

## Limits (honest)

- Not every capturable doc yields rules under the default Haiku extract.  
- Version history API is a stub.  
- Santa Ana is extract-only (no sample addresses in the pack).  
- This is a prototype, not counsel-reviewed advice.
