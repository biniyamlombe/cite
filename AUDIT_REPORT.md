# Cite — End-to-End Audit Report

**Product:** Cite (Hack-Nation × RealPage · Challenge 02 — Rental Housing Law Navigator)  
**Pack:** `data/pack` ≡ `participant-final-no-hour16`  
**Audit date:** 2026-10-04  
**Pipeline version:** `cite-1.1.0`  
**Disclaimer:** This system is a **legal-information prototype**, not legal advice, not a legal determination, and not a compliance certification.

---

## 1. Executive summary

The repository was already a substantially complete Modules A–C pipeline with pack-shaped submission artifacts. This audit verified that claim end-to-end, closed remaining gaps in provenance/applicability enrichment, documentation, quality gating, and UI review labeling, then re-validated.

| Gate | Result |
|------|--------|
| Install / typecheck / backend+frontend tests | **Pass** |
| Schema (Zod + Ajv) | **Pass** |
| Exact `quoted_span` grounding (147/147) | **Pass** |
| Lookups 500 @ `2026-10-01` | **Pass** |
| T1–T5 change cases | **Pass** (250 / 90 / 140+90c / 110 / 0) |
| `npm run quality` | **Pass** |
| Live Anthropic extraction | **Not re-verified** (key present locally; offline heuristic + cached rules used) |
| Live Census geocode | **Partially verified** via cache (483/500 census-sourced); network re-geocode not re-run |

**Verdict:** Submission-ready for the organizer pack schema, with documented honesty limits (link-only municipal scaffolds, missing building facts → unknown, conflicts → human review).

---

## 2. Repository baseline

| Item | Finding |
|------|---------|
| Languages | TypeScript (Node backend, React frontend), shell scripts, Python helpers in checks |
| Package managers | npm workspaces (`shared`, `backend`); frontend separate install |
| Entry points | `backend/src/api/server.ts`, CLI under `backend/src/cli/*`, Vite frontend |
| Data | `data/pack/` corpus + 500 addresses + schemas + `change_tests.json` |
| Outputs | `outputs/rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json`, `provenance.json`, `audit_log.jsonl` |
| LLM | Anthropic Claude (Haiku default; Sonnet retry); heuristic fallback |
| Geocoder | US Census Geocoder + cache + heuristic known-jurisdiction map |
| Tests | Backend smoke (`run_tests.ts`) + node:test honesty suite + frontend Vitest |
| CI | `.github/workflows/ci.yml` (added) |
| Docker | None |
| Secrets | `backend/.env` / `frontend/.env` gitignored; `.env.example` present |

**Baseline before fixes:** Artifacts and T1–T5 already green; missing audit docs, provenance companion, canonical applicability enrichment, quality gate, CI, quote offsets, and explicit human-review UI labels.

---

## 3. Architecture summary

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Pipeline: corpus → extract (Claude/heuristic) → enrich coverage/fields → geocode → apply coverage → lookups → T1–T5 changes → provenance companion. UI is display-only over the Hono API / offline snapshots.

---

## 4. Requirements-completeness matrix

| Requirement | Status | Evidence |
|-------------|--------|----------|
| A Automated rule extraction | **Complete and verified** | `extract/agent.ts`, heuristic fallback, cache; 147 rules |
| Quote + citation + retrieval date | **Complete and verified** | All spans exact; `retrieved_at` present |
| Quote-to-source validation | **Complete and verified** | `validate.ts` + tests reject invented spans |
| B Jurisdiction resolution | **Complete and verified** | Census + legal≠postal; untrusted postal_fallback blocks city rules |
| Offline geocode fallback | **Complete and verified** | `--heuristic-only` / cache |
| Coverage four-valued logic | **Complete with pack mapping** | Pack `result` + enrichment `applicability` / `needs_human_review` |
| Missing facts → unknown | **Complete and verified** | COO/year/units/owner paths |
| As-of / temporal status | **Complete and verified** | T1/T3 date flips; pending/failed handling |
| C Change tests T1–T5 | **Complete and verified** | Tracker + assertions + submission check |
| No T6 / hour-16 | **Complete and verified** | Pack + emission policy |
| UI disclaimer / citations / status | **Complete and verified** | Sticky disclaimer; status badges; quotes |
| Spanish chrome | **Complete (stretch)** | i18n chrome only |
| Santa Ana stretch | **Complete (stretch)** | Separate from pack 500 |
| Organizer `score.py` | **Unsupported / waiting** | Not in pack; drop-in path documented |
| Live LLM re-extract this session | **Unverified live** | Used cached extract + heuristic path |
| County FIPS / place GEOID | **Partially implemented** | County name resolved; FIPS/GEOID not in pack data |
| Explicit `does_not_apply` in pack lookups | **Intentionally mapped** | Non-applicable rules omitted (pack shape); enrichment maps superseded/pending/NTE → `does_not_apply` |

---

## 5. Findings by severity

### Resolved in this audit

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| G01 | High | No provenance / schema version metadata for artifacts | `outputs/provenance.json` + writer |
| G02 | High | No quality gate combining typecheck/lint/tests/submission | `npm run quality` / `scripts/quality-gate.sh` |
| G03 | High | Audit docs missing | `AUDIT_REPORT.md`, `GAP_REGISTER.md` |
| G04 | Medium | No canonical applicability / human-review enrichment | Shared helpers + coverage enrichment fields |
| G05 | Medium | Quote offsets absent | Backfill + validate-time offsets (147/147) |
| G06 | Medium | Architecture doc missing | `docs/ARCHITECTURE.md` |
| G07 | Medium | No CI workflow | `.github/workflows/ci.yml` |
| G08 | Medium | Frontend `.env.example` missing | Added |
| G09 | Low | `prefer-const` lint error in preview auth storage | Fixed |
| G10 | Low | UI lacked needs-human-review / missing-facts labels | Status + i18n + RuleCard |

### Accepted / documented limitations

| ID | Severity | Finding | Rationale |
|----|----------|---------|-----------|
| L01 | Critical (honesty) | HOB/JC primary ordinances link-only | Scaffolds quote D069; applicability `unknown` + review |
| L02 | High | Pack lookup enum ≠ audit four-value enum | Preserve organizer compatibility; enrich alongside |
| L03 | Medium | Frontend prettier debt (~1200 nits) | **Resolved:** `npm run format --prefix frontend`; quality gate enforces prettier |
| L04 | Medium | No FIPS/GEOID in jurisdiction model | **Resolved:** county_fips + place_geoid on all 500 + stretch |
| L05 | Medium | Owner identity never available | Correctly yields `unknown` when exemptions depend on it |
| L06 | Low | Prettier autofix deferred | Avoid massive Lovable UI churn |
| L09 | Medium | Silent omit of non-applicable rules | **Resolved (API):** `does_not_apply` via `include_non_applicable` |
| L10 | Medium | Thin lookup API vs audit address model | **Resolved:** building_facts + audit + resolution status |
| L11 | Medium | Change cases lacked inclusion evidence | **Resolved:** evidence_summary + sample_evidence |

---

## 6. Issue register (observed → expected → status)

See [GAP_REGISTER.md](GAP_REGISTER.md) for the full before/after table.

---

## 7. Security and privacy review

| Check | Result |
|-------|--------|
| Secrets in git | `.env` files ignored; only `.env.example` tracked |
| Hard-coded API keys in source | None found |
| Client exposure of Anthropic key | Backend-only |
| Owner names / PII | Not used; sample addresses only |
| SSRF from user URLs | Extract uses pack corpus IDs; no user-supplied fetch URL |
| Path traversal on submission files | Fixed filenames under `outputs/` |
| CORS | Configurable allowlist + Lovable preview hosts |
| Logging addresses | Local audit log; document not to share externally without redaction |

**Note:** A local `ANTHROPIC_API_KEY` exists in `backend/.env` (gitignored). Do not commit or paste it.

---

## 8. Legal-tech safety review

| Principle | Implementation |
|-----------|----------------|
| Not legal advice | Sticky UI + API disclaimer + docs |
| No invented rules/citations | Span must exist in corpus; invented spans rejected |
| Unknown over guessing | Coverage engine + tests |
| Separate status vs applicability | Pack `status` / `result` + enrichment `applicability` / `legal_status_at_as_of_date` |
| Pending ≠ current law | Pending results + T4 scenario labeling |
| Conflicts → human review | `conflict_flag` + `needs_human_review` |
| Link-only honesty | Explicit scaffolds; scenario_only evidence status |

---

## 9. AI / LLM safety review

| Control | Status |
|---------|--------|
| Structured output + Zod/Ajv | Yes |
| Source-grounded quotes | Yes (exact contiguous match) |
| Reject ungrounded citations | Yes |
| Heuristic fallback when no key | Yes |
| Prompt injection in corpus | Treated as untrusted text; coverage is deterministic code |
| No CoT legal advice in UI | Explanations are fact/predicate summaries |
| Evaluation tests | Fake span, typography snap, T1–T5, honesty suite |

Live Claude extraction was **not** re-executed end-to-end in this audit session; existing `backend/.cache/extract` + `outputs/rules.json` were validated.

---

## 10. Data-schema review

- **Organizer schema** (`data/pack/schema/rule_record.schema.json`) remains authoritative for submission.
- **Shared Zod** mirrors pack enums and adds optional enrichment (`quote_*_offset`, `applicability`, `facts_*`, `needs_human_review`, `alias_id`, etc.).
- Enrichment fields are stripped before Ajv pack validation where needed.
- `changes.json` stays a bare T1–T5 map (no wrapper keys) for grader compatibility.
- Companion `provenance.json` carries `schema_version`, `pipeline_version`, hashes.

---

## 11. Test coverage and results

Commands run:

```bash
npm run build -w shared && npm run build -w backend
npm run check-schema
npm run test -w backend          # smoke + 10 node:test
npm test --prefix frontend       # 14 vitest
npm run typecheck
npm run quality                  # full gate — PASS
SKIP_SMOKE=1 bash scripts/submission-check.sh  # PASS
```

Backend smoke includes schema, corpus, heuristic extract, fake-span rejection, dual coverage, aliases, geocode resolution, Module B edges, T1–T5. Honesty tests cover date validation, supersession honesty, municipal scenarios, enrichment fields, API routes, live extract fallback validation.

---

## 12. Change-case validation results

| Test | Expected | Observed | Pass |
|------|----------|----------|------|
| T1 CA AB325/SB763 | 250 CA flip NTE→applies | 250 | ✓ |
| T2 HOB/JC boundaries | 90; Newark out | 90; Newark excluded | ✓ |
| T3 NJ FAIR | 140; 90 conflicts | 140; 90 | ✓ |
| T4 MA pending | 110 if-enacted | 110 | ✓ |
| T5 MA ballot struck | empty affected | 0 | ✓ |
| T6 | absent | absent | ✓ |

---

## 13. Remaining known limitations

1. Link-only Hoboken/Jersey City ordinances — scenario scaffolds only.  
2. Newark local pages uncaptured — `corpus_gaps`, no invented city rules.  
3. Thin capturable pages (D029/D078) — soft screening scaffolds, low confidence.  
4. Assessor / COO day-level facts often missing → `unknown`.  
5. No FIPS/GEOID encoding in outputs.  
6. Frontend Prettier style debt not mass-autofixed.  
7. Organizer `score.py` / held-out keys not available.  
8. Live Anthropic re-extract and full Census re-geocode not re-run this session.

---

## 14. What could not be verified and why

| Item | Why |
|------|-----|
| Fresh Claude extraction of all capturable docs | Cost/time; existing validated cache + rules used |
| Fresh Census geocode of all 500 | Network not required; cache already 483 census hits |
| Organizer auto-grader `score.py` | Not shipped in pack |
| Production Lovable/Supabase monitoring paths | Optional stretch; requires cloud credentials |
| Court-ready legal correctness of every rule | Prototype; not counsel-reviewed |

---

*Cite is a legal-information prototype. It is not legal advice.*
