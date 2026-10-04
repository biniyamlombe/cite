# Cite — Gap Register

**Disclaimer:** Legal-information prototype — not legal advice.

| ID | Requirement | Status before | Status after | Severity | Files changed | Test or evidence | Notes |
|----|-------------|---------------|--------------|----------|---------------|------------------|-------|
| G01 | Artifact provenance / schema version | Missing | Complete | High | `backend/src/lib/provenance.ts`, `cli/write_provenance.ts`, `outputs/provenance.json` | submission-check provenance lines | Companion file; pack JSON stays bare |
| G02 | Quality gate command | Missing | Complete | High | `scripts/quality-gate.sh`, `package.json` | `npm run quality` PASS | Substantive ESLint; prettier non-blocking |
| G03 | Audit report / gap register | Missing | Complete | High | `docs/audit-report.md`, `docs/gap-register.md` | files present | This audit |
| G04 | Canonical applicability + human review fields | Partial (conflict_flag only) | Complete | Medium | `shared/src/index.ts`, `apply/coverage.ts`, API, UI | honesty.test enrichment | Pack `result` preserved |
| G05 | Quote offsets | Missing | Complete | Medium | `lib/validate.ts`, `cli/enrich_quote_offsets.ts`, `rules.json` | 147/147 filled | Traceability |
| G06 | Architecture documentation | Partial (METHOD only) | Complete | Medium | `docs/system-architecture.md` | doc present | Mermaid data flow |
| G07 | CI workflow | Missing | Complete | Medium | `.github/workflows/ci.yml` | workflow file | Runs quality gate |
| G08 | Frontend env example | Missing | Complete | Medium | `frontend/.env.example` | file present | Safe placeholders |
| G09 | prefer-const lint defect | Defective | Fixed | Low | `frontend/.../previewAuthStorage.ts` | eslint quiet pass | |
| G10 | UI needs-human-review / missing facts | Partial | Complete | Low | `status.tsx`, `rule.tsx`, `i18n.tsx`, `types.ts`, `routes/index.tsx` | vitest + manual labels | |
| G11 | Deterministic lookup key/order | Partial | Complete | Low | `cli/lookup.ts`, `apply/coverage.ts` | sorted address keys + rule ids | |
| G12 | HOB/JC requires_human_review metadata | Partial | Complete | Medium | `extract/ensure_aliases.ts` | alias scaffolds | Coverage also keys on alias_id |
| G13 | Submission check enrichment | Partial | Complete | Medium | `scripts/submission-check.sh` | enrichment + provenance checks | SKIP_SMOKE for nested gate |
| R01 | Module A automated extract | Complete | Complete | — | existing extract pipeline | smoke + span tests | Claude + heuristic |
| R02 | Module B geocode + coverage | Complete | Complete | — | existing apply/geocode | smoke Module B | unknown over guess |
| R03 | Module C T1–T5 | Complete | Complete | — | `changes/tracker.ts` | T1–T5 asserts | No T6 |
| R04 | 500 lookups @ 2026-10-01 | Complete | Complete | — | `outputs/lookups.json` | submission-check | |
| R05 | Exact citations | Complete | Complete | — | validate + rules | 0 bad spans | |
| R06 | Not-legal-advice UX | Complete | Complete | — | layout + API | i18n disclaimer | |
| L01 | Link-only HOB/JC ordinances | Limitation | Documented | Critical honesty | scaffolds | T2/T3 + honesty tests | Never invent municipal code |
| L02 | Pack vs audit enum mismatch | Limitation | Mapped | High | shared mapping helpers | toCanonicalApplicability tests | Organizer compatibility |
| L03 | Frontend prettier debt | Limitation | **Complete** | Medium | `npm run format --prefix frontend` | full eslint+prettier quiet | Quality gate now enforces prettier |
| L04 | FIPS / GEOID | Missing | **Complete** | Medium | `geocode/jurisdiction_ids.ts`, `census.ts`, `enrich_geocode_ids.ts`, UI stack | 500/500 FIPS+GEOID; honesty test | Untrusted cities get null place_geoid |
| L05 | Owner-type facts | Unsupported by data | Correct unknown | Medium | coverage engine | honesty tests | |
| L06 | Live LLM re-extract this session | Unverified | Documented | Medium | — | cache validated | |
| L07 | Organizer score.py | Unsupported | Documented | Medium | `docs/organizer-scoring.md` | waiting on organizers | |
| L08 | County-level rule layer enum | Pack is state\|city | Accepted | Low | pack schema | — | County + FIPS in geocode/API stack |
| L09 | Explicit does_not_apply | Omitted silently | **Complete (API)** | Medium | `apply/coverage.ts`, `/lookup?include_non_applicable=1` | honesty.test | Pack lookups still omit (grader shape) |
| L10 | Rich address lookup API shape | Partial | **Complete** | Medium | `api/server.ts`, shared LookupResponseSchema, UI | building_facts + audit + jurisdiction status | |
| L11 | Change-case evidence | Notes only | **Complete** | Medium | `changes/tracker.ts` | evidence_summary + sample_evidence T1–T5 | |

## Severity legend
- **blocker** — cannot submit  
- **critical** — safety / honesty risk if mishandled  
- **high / medium / low** — completeness or DX
