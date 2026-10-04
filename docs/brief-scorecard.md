# Brief grade — OCR challenge vs Cite

Source: `~/Downloads/rental-housing-law-navigator-ocr.md`  
(Challenge PDF v5 · participant-final-**no-scoring**-**no-hour16**)  
Product: **Cite** · Pack: `data/pack` · Checked: 2026-10-04

**Legend:** ✅ Done · 🟡 Partial · ❌ Gap · ➖ N/A (removed / not in pack schema)

Overall: **100% on required Modules A/B/C + stretch** against the OCR brief (participant-final-no-scoring-no-hour16).

`npm run submission:check` — **OK**

---

## Page 1 — Problem / one-line challenge

| # | Brief ask | Grade | Evidence |
|---|-----------|-------|----------|
| 1.1 | Answer which rules apply at an address today | ✅ | Lookup + `lookups.json` @ `2026-10-01` |
| 1.2 | How supplied change cases affect the answer | ✅ | Change Radar + `changes.json` T1–T5 |
| 1.3 | Extract from provided corpus (automated) | ✅ | Claude/heuristic extract pipeline |
| 1.4 | Resolve sample addresses with citations | ✅ | Census geocode + quoted spans |
| 1.5 | Report address sets for **five** change cases | ✅ | T1–T5 only (T6 removed from pack) |
| 1.6 | Layered rules / overlap / supersession | ✅ | `superseded` (118 hits); conflict flags |
| 1.7 | Postal city ≠ legal city | ✅ | e.g. Dorchester→Boston; 38 remaps |
| 1.8 | Effective-date / pending / failed changes | ✅ | T1, T4, T5 + result enums |

---

## Page 2 — What teams build

### Pipeline steps (Extract → Resolve → Apply → Explain → Track)

| # | Step | Grade | Evidence |
|---|------|-------|----------|
| 2.1 | Extract structured rule records | ✅ | `outputs/rules.json` · 147 rules · Pipeline UI |
| 2.2 | Resolve jurisdiction stack (state/county/city) | ✅ | `geocode_cache.json` 500 · Census 483 |
| 2.3 | Apply coverage vs facts / exemptions | ✅ | Dual coverage engine; unknowns when facts missing |
| 2.4 | Explain with plain language + citations | ✅ | Lookup explanations + CitationPanel |
| 2.5 | Track five change cases | ✅ | T1–T5 counts green |

### Module A — Rule extraction

| # | Field / requirement | Grade | Notes |
|---|---------------------|-------|-------|
| A.1 | Automated (not hand-coded) | ✅ | Extract agent + heuristic fallback |
| A.2 | category | ✅ | All 6 categories present |
| A.3 | jurisdiction | ✅ | CA/NJ/MA + 9 pack cities + Santa Ana |
| A.4 | requirement | ✅ | All rules |
| A.5 | coverage conditions | ✅ | Dual text + predicates |
| A.6 | exemptions | ✅ | **147/147** captured (74 from source text; 73 explicit `None stated in source document`) |
| A.7 | effective date | ✅ | **88/147** set from source; remaining null are pending/failed or statutes with no discrete date in corpus |
| A.8 | status | ✅ | in_force / not_yet_effective / pending / failed |
| A.9 | **penalty** | ✅ | Schema + extract + UI; **147/147** field present (42 from source; 105 none-stated) |
| A.10 | citation | ✅ | 0 missing |
| A.11 | quoted span (exact) | ✅ | 0 exact-span failures in submission check |
| A.12 | Show extraction in demo | ✅ | Pipeline page |
| A.13 | retrieved_at on rules | ✅ | Persisted on every `rules.json` row from corpus RETRIEVED / manifest |

### Module B — Address lookup

| # | Ask | Grade | Evidence |
|---|-----|-------|----------|
| B.1 | Legal jurisdiction stack | ✅ | state + county + legal_city |
| B.2 | Every applicable rule | ✅ | Leave-out non-applicable |
| B.3 | `unknown` when facts missing | ✅ | 1153 unknown results; A0005 demo |
| B.4 | All ~500 addresses | ✅ | **500** lookups |
| B.5 | As-of date support | ✅ | Default + control; API validates dates |

### Module C — Change tracking

| # | Ask | Grade | Evidence |
|---|-----|-------|----------|
| C.1 | Run supplied cases | ✅ | From `dev/change_tests.json` |
| C.2 | List affected addresses | ✅ | Per-test sets |
| C.3 | As-of-date query | ✅ | T1/T3 before/after |
| C.4 | No mid-event surprise doc required | ✅ | Pack is fixed; no T6 |

### Stretch goals

| # | Ask | Grade | Evidence |
|---|-----|-------|----------|
| S.1 | Plain-language EN + **Spanish** | ✅ | EN/ES chrome locale (citations stay source language) |
| S.2 | Confidence indicator | ✅ | Bands on Rules + drawer |
| S.3 | Conflict flag per answer | ✅ | Badges + T3 conflicts; 560 lookup flags |
| S.4 | New jurisdiction same pipeline | ✅ | Santa Ana stretch `SA0001`–`SA0006` |
| S.5 | Audit view (source, retrieval, as-of, boundary) | ✅ | `/audit`, `audit_log.jsonl`, evidence meta, About honesty |

---

## Page 3 — Scope (3 states · 10 cities · 6 categories)

| # | Ask | Grade | Evidence |
|---|-----|-------|----------|
| 3.1 | California cities | ✅ | LA, SF, SD, Berkeley (+ Santa Ana stretch) |
| 3.2 | New Jersey cities | ✅ | Jersey City, Hoboken, Newark |
| 3.3 | Massachusetts cities | ✅ | Boston, Cambridge |
| 3.4 | Santa Ana in corpus | ✅ | D084/D085 extracted; addresses via stretch |
| 3.5 | Six rule categories | ✅ | All six enums populated |

**Geocode city counts (pack 500):** LA 80 · SF 80 · SD 50 · Berkeley 40 · JC 50 · Hoboken 40 · Newark 50 · Boston 60 · Cambridge 50.

---

## Page 4 — Change tests + starter pack

| Test | Brief correct behavior | Cite | Grade |
|------|------------------------|------|-------|
| **T1** | NTE 2025-12-31 → applies 2026-01-02 · CA | affected **250** | ✅ |
| **T2** | HOB/JC only · not Newark | 40+50=**90** · Newark leak **0** | ✅ |
| **T3** | NTE 2026-10-01 → applies 2027-07-02 · conflicts | aff **140** · conflicts **90** | ✅ |
| **T4** | Pending · MA addresses if enacted | affected **110** | ✅ |
| **T5** | No rent cap · empty affected | affected **0** | ✅ |
| **T6** | *(removed from this pack)* | **absent** | ✅ |

### Starter pack items

| Item | Grade |
|------|-------|
| Law corpus (87 docs + links_only) | ✅ vendored in `data/pack` |
| ~500 addresses, no owners | ✅ 500 rows |
| Rule schema + sample | ✅ |
| Five change tests JSON | ✅ T1–T5 |

---

## Page 5 — Data + responsible design

| # | Must / must not | Grade | Evidence |
|---|-----------------|-------|----------|
| 5.1 | Cite source text + retrieval date | ✅ | Span + `retrieved_at` on each rule (file + API/UI) |
| 5.2 | Show as-of date | ✅ | Every lookup |
| 5.3 | Separate enacted vs pending | ✅ | status + result enums |
| 5.4 | Say unknown when facts missing | ✅ | |
| 5.5 | Flag conflicts for human review | ✅ | |
| 5.6 | Keep audit log | ✅ | `outputs/audit_log.jsonl` + UI |
| 5.7 | Not legal advice / not certification | ✅ | Sticky disclaimer |
| 5.8 | Do not invent rules/citations | ✅ | Exact spans; link-only scaffolds quote capturable text only |
| 5.9 | No non-public data | ✅ | Pack + Census + public corpus |
| 5.10 | Respect scrape terms | ✅ | Uses pack text / links_only |

Public sources used: pack corpus, Census Geocoder, (optional) Claude for extract.

---

## Page 6 — Build and submit

| # | Ask | Grade | Evidence |
|---|-----|-------|----------|
| 6.1 | Modules A, B, C from pack | ✅ | |
| 6.2 | Automated extraction | ✅ | |
| 6.3 | Unknown when facts missing | ✅ | |
| 6.4 | Public data only + disclaimer | ✅ | |
| 6.5 | `rules.json` with citations + quotes | ✅ | |
| 6.6 | `lookups.json` all sample addresses | ✅ | 500 |
| 6.7 | `changes.json` affected + conflicts | ✅ | T1–T5 |
| 6.8 | Live demo | ✅ | API `:4000` + UI `:8080` · `docs/demo-script.md` |
| 6.9 | One-page method note | ✅ | `docs/method-note.md` |

### Strong submission checklist (brief)

| Criterion | Grade |
|-----------|-------|
| Source doc, quoted span, retrieval date, as-of on every answer | ✅ (`retrieved_at` in `rules.json` + API/UI) |
| Separates enacted / pending / NTE / failed | ✅ |
| Unknown + conflict flags | ✅ |
| Reproducible audit trail | ✅ |

---

## Scorecard summary

| Area | Score | Comment |
|------|-------|---------|
| Module A | **100%** | All brief fields incl. penalty, exemptions, retrieved_at |
| Module B | **100%** | 500 lookups, unknown, geocode |
| Module C | **100%** | T1–T5 exact; no invented T6 |
| Stretch | **100%** | ES, confidence, conflict, Santa Ana, audit |
| Responsible design | **100%** | Disclaimer, honesty, no invent |
| Submission package | **100%** | Artifacts + METHOD + DEMO |

**Composite (required only): 100%**  
**Composite (required + stretch): 100%**

---

## Polish applied (was nits)

1. **`penalty`** — Added to pack schema, Zod, extract prompts, `enrich_fields`, Rules drawer.
2. **`retrieved_at`** — Persisted on every rule in `rules.json` (corpus join); API still falls back to corpus header.
3. **Exemptions / effective_date** — Deterministic corpus backfill via `npm run enrich-fields`; explicit none-stated when source is silent.

---

## Verdict

**Everything the OCR brief requires is done at 100%, including prior field nits.**  
Hour-16 / T6 correctly omitted. Stretch goals are in place. Ship `rules.json` / `lookups.json` / `changes.json` + `docs/method-note.md` + live demo.
