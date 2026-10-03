---
name: rental-housing-law-navigator
description: >-
  Build Hack-Nation challenge 02 Rental Housing Law Navigator (RealPage): extract
  structured rules from the starter corpus, resolve address-level applicability with
  citations, and track law changes T1–T6. Use when working on Hack-Nation, RealPage,
  challenge 02, Module A/B/C, rule_record.schema.json, corpus_manifest, sample_addresses,
  change_tests, rules.json, lookups.json, changes.json, score.py, or housing law navigation.
---

# Rental Housing Law Navigator (Challenge 02)

Hack-Nation × RealPage · 7th Global AI Hackathon · October 2026

**Authoritative brief:** starter pack `corpus/02.pdf` (challenge brief).  
**Authoritative ops guide:** starter pack `README.md` (participant guide).  
**Default query date:** `2026-10-01`.

**Core question:** Which rules apply here today, and what is about to change?

Every interface must say **not legal advice**.

## Starter pack layout

Pack root (this workspace): `participant-final-no-hour16/`

| Path | Use |
|------|-----|
| `corpus/02.pdf` | Challenge brief (goals, modules, scope, scoring overview) |
| `corpus/corpus_manifest.csv` | 87 docs: `doc_id`, jurisdictions, URL, capture status |
| `corpus/text/D*.txt` | Captured official text (URL + retrieval date in header) |
| `corpus/links_only.csv` | Link-only / blocked sources — do not invent text for these |
| `data/sample_addresses.csv` | 500 multifamily rows (jurisdiction not given) |
| `schema/rule_record.schema.json` | Required rule record format |
| `schema/sample_rule_record.json` | Worked example |
| `dev/change_tests.json` | T1–T5 (this pack; T6 hour-16 arrives mid-event) |
| `submission_templates/` | Shapes for `rules.json`, `lookups.json`, `changes.json` |

This pack variant is **no-hour16 / no scoring script**. When organizers add `score.py`, a dev answer key, or the hour-16 ordinance, treat those as source of truth for self-test and T6.

Details: [challenge-brief.md](challenge-brief.md) · [starter-pack.md](starter-pack.md) · [responsible-ai.md](responsible-ai.md)

## What to build (from 02.pdf)

Five pipeline steps; three scored modules:

| Step | Job |
|------|-----|
| 1 Extract | Statutes/ordinances → structured rule records (provided schema) |
| 2 Resolve | Geocode address → jurisdiction stack: state, county, city |
| 3 Apply | Test coverage vs building facts: year built, units, owner type |
| 4 Explain | Applicable rules with plain-language summary + citation |
| 5 Track change | New/pending law → affected addresses + before/after |

### Module A — Rule extraction (required)

Automated agent over the corpus → **one record per rule**. Not hand-coded.

Match `schema/rule_record.schema.json`. Required fields:

`team_rule_id`, `jurisdiction`, `level`, `category`, `status`, `title`, `requirement`, `citation`, `source_url`, `quoted_span`

| Field | Allowed values |
|-------|----------------|
| `level` | `state` \| `city` |
| `category` | `rent_increase_limits` \| `just_cause_eviction` \| `security_deposits` \| `application_screening_fees` \| `screening_restrictions` \| `algorithmic_rent_setting` |
| `status` | `in_force` \| `not_yet_effective` \| `pending` \| `failed` (as of query date; default 2026-10-01) |

Also capture when present: `key_value`, `coverage_conditions`, `exemptions`, `overrides`, `interaction`, `effective_date`, `source_doc_id`, `confidence`, `conflict_flag`, `conflict_note`.

`quoted_span` must be exact corpus text (min 20 chars). Prefer `source_doc_id` from the manifest.

### Module B — Address lookup (required)

For each address in `data/sample_addresses.csv`:

1. Resolve **legal** jurisdiction (Census Geocoder). `postal_city` ≠ legal city (e.g. Van Nuys → Los Angeles; Dorchester → Boston).
2. Build stack: state → county → city.
3. Evaluate each rule’s coverage; return jurisdiction stack + applicable rules with explanation + citation.
4. Local overrides state → say so (`superseded` / `interaction`).
5. Missing fact → `unknown`, never guess.

**Lookup `result` values** (exact strings):

| Value | Meaning |
|-------|---------|
| `applies` | In force and covers this address |
| `unknown` | Depends on facts not in the data |
| `superseded` | Covered, but a stricter/other-level rule governs |
| `not_yet_effective` | Enacted; effective date after query date |
| `pending` | Bill/proposal, not law |

Omit rules that don’t apply. Cover **all 500** addresses.

### Module C — Change tracking (required)

Run `dev/change_tests.json` (T1–T5 now; T6 when released). For each: affected `address_id`s, before/after where relevant, conflict flags (T3), as-of date support.

### Stretch

- Plain language EN + ES
- Confidence + conflict flag per answer
- One new jurisdiction live during the event

## Scope

3 states · 10 cities · 6 categories (Santa Ana: extraction only, no addresses).

Address counts: LA 80 · SF 80 · San Diego 50 · Berkeley 40 · Jersey City 50 · Hoboken 40 · Newark 50 · Boston 60 · Cambridge 50.

## Critical data quirks (from participant guide)

- No owner names → owner-type / small-landlord tests → `unknown` or explain why exception can’t apply.
- Year built ≠ certificate of occupancy. Cutoff-year buildings → `unknown` (SF COO ≤ 1979-06-13; LA ≤ 1978-10-01).
- Missing year_built: San Diego, Berkeley; missing units: Berkeley, many NJ rows, Boston `A/` apartments.
- Do not invent text for `links_only` / uncaptured docs.

## Submission formats

### `rules.json`

```json
{ "rules": [ /* rule_record objects */ ] }
```

### `lookups.json`

```json
{
  "as_of": "2026-10-01",
  "lookups": {
    "A0001": [
      {
        "team_rule_id": "r-0007",
        "result": "applies",
        "explanation": "...",
        "conflict_flag": false
      }
    ]
  }
}
```

### `changes.json`

```json
{
  "T1": { "affected_address_ids": ["A0002"], "notes": "..." },
  "T3": {
    "affected_address_ids": ["A0001"],
    "conflict_flag_address_ids": ["A0001"],
    "notes": "..."
  }
}
```

Also: GitHub (code + README + outputs), live demo, three videos (team / demo with scores / technical). Demo should show extraction pipeline, T1–T5 (and T6 when available), and `score.py` when provided.

## Scoring (from 02.pdf)

| Component | Pts | Type |
|-----------|-----|------|
| Extraction accuracy | 25 | auto |
| Address coverage | 20 | auto (missed `applies` costs 2×; `unknown` partial credit) |
| Citations | 15 | auto (quoted span in corpus) |
| Change tracking | 15 | auto (+ T3 conflict flags) |
| Plain language / usability | 10 | judges |
| Responsible design | 10 | judges |
| Scalability path | 5 | judges |

MVP: Modules A + B. Full matching rules are in the participant guide when scoring files ship.

## Build checklist

```
Progress:
- [ ] Load manifest + text/; extract → rules.json validated against schema
- [ ] Geocode 500 addresses; store legal city/county/state
- [ ] Coverage engine: conditions, exemptions, local vs state, as-of date
- [ ] lookups.json for all address_ids with correct result enums
- [ ] change_tests T1–T5 → changes.json (T6 when hour-16 drops)
- [ ] UI: as-of date, citations, unknown, conflict flags, “not legal advice”
- [ ] Self-test with score.py / dev key when available
```

## When implementing

1. Treat `corpus/02.pdf` + pack `README.md` + `schema/rule_record.schema.json` as ground truth over chat summaries.
2. Read [starter-pack.md](starter-pack.md) for paths, address gaps, and change-test IDs.
3. Read [responsible-ai.md](responsible-ai.md) before any UI copy.
4. Prefer corpus text over live scraping; CA legislature blocks scripts — use pack copies.
5. Optimize for exact enum strings and citation spans found in `corpus/text/`.
