# Cite

**Hack-Nation × RealPage · Challenge 02 — Rental Housing Law Navigator**

Cite answers: *which housing rules appear to apply at this address on a given date, what is about to change, and why — with exact corpus citations?*

| | |
|---|---|
| **Product** | Legal-information prototype (Modules A extract → B geocode/coverage → C change tests) |
| **Default as-of** | `2026-10-01` |
| **Stack** | Hono API `:4000` · Vite / TanStack UI (often `:8080`) · Zod contracts in `shared/` |
| **Pack** | Participant-final **no-hour16** — T1–T5 only (no T6) |

> **Not legal advice.** Cite is not a compliance certificate, not counsel, and not a final legal determination. Prefer **unknown** over guessing building facts or inventing municipal code.

---

## Contents

1. [What you get](#what-you-get)
2. [Honesty principles](#honesty-principles)
3. [Repository layout](#repository-layout)
4. [Prerequisites](#prerequisites)
5. [Setup](#setup)
6. [Environment variables](#environment-variables)
7. [Run the live demo](#run-the-live-demo)
8. [Demo pages & judge path](#demo-pages--judge-path)
9. [Generate / refresh submission outputs](#generate--refresh-submission-outputs)
10. [Quality, tests, and preflight](#quality-tests-and-preflight)
11. [Submission pack & scoring](#submission-pack--scoring)
12. [HTTP API](#http-api)
13. [Modules A–C](#modules-ac)
14. [UX architecture](#ux-architecture)
15. [Offline demo & monitoring](#offline-demo--monitoring)
16. [Spanish / localization](#spanish--localization)
17. [Known limits](#known-limits)
18. [Documentation index](#documentation-index)
19. [Troubleshooting](#troubleshooting)

---

## What you get

Current checked-in artifacts (re-run `npm run pipeline` / `npm run submission:check` after regenerating):

| Artifact | Location | Snapshot |
|----------|----------|----------|
| Extracted rules | `outputs/rules.json` | **147** rules · six required categories · change-test aliases present |
| Address lookups | `outputs/lookups.json` | **500** pack addresses @ `2026-10-01` |
| Change tests | `outputs/changes.json` | **T1–T5** (`T1=250`, `T2=90`, `T3=140` +90 conflicts, `T4=110`, `T5=0`) |
| Geocode cache | `outputs/geocode_cache.json` | Census + FIPS / place GEOID enrichment |
| Provenance | `outputs/provenance.json` | Schema/pipeline versions + content hashes (companion; pack JSON stays grader-shaped) |
| Rule versions | `outputs/rule_versions.json` | Alias-keyed history for UI / `GET /rules/:id/versions` |
| Audit log | `outputs/audit_log.jsonl` | Extract / quote / test events |
| Stretch | `outputs/stretch_*.json` + `data/stretch/` | Santa Ana demo addresses (outside the graded 500) |

Deploy / pitch needs the repo **as-is**: `data/pack/` + `outputs/` (including `geocode_cache.json`) + `backend/` + `frontend/` + `shared/`.

---

## Honesty principles

These are product constraints, not polish:

- **Exact citations.** Every rule’s `quoted_span` must appear **verbatim** in corpus text (snap + reject).
- **Unknown over guessing.** Missing `year_built` / `units` / `owner_type` can yield `unknown` — never invented assessor facts.
- **Postal ≠ legal city.** City rules attach to Census legal jurisdiction (e.g. Dorchester postal → Boston legal).
- **Dual status.** Coverage applicability (`appears to apply` / `unknown` / …) is separate from legal status (`in force` / `pending` / `not yet effective` / `failed`).
- **Pending / NTE are not current law.** They never sit under “Appear to apply.”
- **Link-only municipalities.** Hoboken / Jersey City primary ordinance pages are scaffolds quoting **NJ FAIR Act (D069)** — never invented municipal code. Live applicability stays `unknown` / scenario-labeled.
- **Conflicts need humans.** Overlaps (e.g. NJ FAIR vs local alg rules) flag `needs_human_review` without picking a legal winner.
- **Session fact overrides.** Year/units entered in the UI preview coverage for this session only; they are marked `user_provided` and are not corpus truth.
- **UI is display-only.** No browser-side legal evaluation — live Hono API or offline corpus snapshots only.

---

## Repository layout

| Path | Role |
|------|------|
| `backend/` | Claude extraction, Census geocoding, coverage engine, change tracker, Hono API (`:4000`) |
| `frontend/` | Lovable / Vite Cite UI (TanStack Start + React) — talks to the Hono API |
| `shared/` | Zod schemas shared by FE/BE (`API_SCHEMA_VERSION`, lookup/result contracts) |
| `data/pack/` | Vendored participant starter pack (corpus, 500 addresses, schemas, `dev/change_tests.json`) |
| `data/stretch/` | Santa Ana demo addresses (stretch jurisdiction; not in pack 500) |
| `outputs/` | Graded + companion artifacts listed above |
| `scripts/` | `quality-gate.sh`, `submission-check.sh`, `submission-pack.sh`, `demo-preflight.sh`, `demo-tunnel.sh` |
| `docs/` | All product docs — method note, demo script, architecture, UX, audit, scoring |

Frontend is **not** an npm workspace member (Lovable peer deps). Use `npm install --prefix frontend` (or `npm run install:all`).

---

## Prerequisites

- **Node.js** 20+ recommended (matches typical Vite / workspace tooling)
- **npm** 10+
- Optional: **Anthropic API key** for Claude extraction (heuristic fallback works without it)
- Optional: network for Census Geocoder (or use `--heuristic-only` / cached `geocode_cache.json`)
- Optional: Cloudflare tunnel CLI for Lovable cloud → laptop API (`npm run demo:tunnel`)

---

## Setup

```bash
# 1) Backend + shared (npm workspaces)
npm install
npm run build -w shared

# 2) Frontend (separate install — Lovable/Vite peer deps break workspaces)
npm install --prefix frontend --legacy-peer-deps

# Or one shot:
# npm run install:all

# 3) Backend env
cp backend/.env.example backend/.env
# Edit backend/.env — see Environment variables below

# 4) Frontend env — required for live demo
cp frontend/.env.example frontend/.env.local
# Ensure: VITE_API_URL=http://localhost:4000
```

Verify contracts build:

```bash
npm run typecheck
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `ANTHROPIC_API_KEY` | _(empty)_ | Claude extraction; heuristic fallback if unset |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Default extract model |
| `ANTHROPIC_RETRY_MODEL` | `claude-sonnet-4-5` | Empty-cache upgrades + `extract -- --retry-failed` |
| `EXTRACT_CONCURRENCY` | `4` | Parallel docs during extract |
| `AS_OF_DEFAULT` | `2026-10-01` | Default evaluation date |
| `PACK_ROOT` | `./data/pack` | Pack root override |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | localhost UI ports | Comma-separated UI origins (see `.env.example`) |

### Frontend (`frontend/.env.local`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:4000` | Live Cite API. **Unset** → offline corpus snapshots |
| `VITE_SUPABASE_URL` | _(optional)_ | Monitoring / team features on Lovable Cloud |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | _(optional)_ | Same |
| `VITE_SUPABASE_PROJECT_ID` | _(optional)_ | Same |

Lovable preview hosts are allowed by the API CORS helper by default; still set `CORS_ORIGIN` if you use a custom origin.

---

## Run the live demo

```bash
# Terminal 1 — API
npm run dev:backend

# Terminal 2 — UI
echo 'VITE_API_URL=http://localhost:4000' > frontend/.env.local
npm run dev:frontend

# Before pitching (live API + four demo stories + T1–T5)
npm run demo:preflight
```

| Surface | URL |
|---------|-----|
| UI | Vite terminal port (often `http://localhost:8080`) |
| API health | `http://localhost:4000/health` |
| API operator console | `http://localhost:4000/` (HTML) |
| Version | `http://localhost:4000/version` |

**Lovable cloud only** (localhost won’t reach your laptop):

```bash
npm run demo:tunnel
# Copy the https://….trycloudflare.com URL into Lovable as VITE_API_URL
# Re-run: VITE_API_URL=https://… npm run demo:preflight
```

Quick tunnels mint a **new URL every restart**. Prefer **local UI + local API** if Wi‑Fi is flaky.

Full judge script (~4 minutes): **[docs/demo-script.md](docs/demo-script.md)**.

---

## Demo pages & judge path

### Primary nav

1. **Lookup** — address + as-of → jurisdiction stack, answer summary, grouped results (appear to apply / need more facts / human review / do not appear to apply / pending·NTE), evidence drawer, session fact overrides, audit details
2. **Change scenarios** — T1–T5 with current-law vs scenario labeling, affected counts, conflict flags; T5 empty set is explicit
3. **How it works** (`/about`) — method + not-legal-advice commitments
4. **Sources & limits** (`/sources`) — provenance and corpus limitations
5. **More →** Audit, Pipeline, Rules, Coverage, Dashboard, … (advocate / extract tools; secondary to the demo path)

### Stories to click (live)

| ID | Point |
|----|--------|
| **A0005** | Berkeley — missing year/units → `unknown` over guessing; session overrides preview coverage |
| **A0065** | Dorchester postal → **legal city Boston** |
| **A0002** | Hoboken — link-only honesty, conflict / human review, NJ FAIR citation (not invented city code) |
| **SA0001** / **SA0003** | Santa Ana stretch — apply vs 15-year just-cause omit (outside graded 500) |

### UX checklist

Manual acceptance before pitching: **[docs/ux-test-checklist.md](docs/ux-test-checklist.md)** (browser-verified 2026-10-04; results in [docs/ux-implementation-report.md](docs/ux-implementation-report.md) §5a).

---

## Generate / refresh submission outputs

```bash
# Prove organizer sample validates (Zod + Ajv) before extract
npm run check-schema

# Full pipeline (schema → extract → enrich → geocode → lookup → changes → provenance)
npm run pipeline

# Offline geocode (no Census network):
# npm run pipeline -- --heuristic-geo

# Or step by step
npm run extract                      # Haiku default; auto-upgrades empty caches with Sonnet
npm run extract -- --retry-failed    # Sonnet on uncovered capturable docs (merges)
npm run enrich-coverage              # plain-language text + executable predicates
npm run geocode                      # Census; add -- --heuristic-only to skip network
npm run lookup                       # default as_of=2026-10-01
npm run changes
npm run write-provenance             # companion hashes / versions (pack JSON stays bare)

# Stretch jurisdiction (Santa Ana) — does not alter T1–T5 / pack 500
npm run stretch

# After changing artifacts, refresh offline UI snapshots
npm run demo:snapshots
```

Outputs land in `outputs/` matching challenge templates. Pack-shaped `rules.json` / `lookups.json` / `changes.json` stay grader-compatible; enrichment fields and `provenance.json` are companions.

---

## Quality, tests, and preflight

```bash
npm test                 # backend smoke + honesty/API UX + frontend Vitest (build shared first)
npm run typecheck        # shared + backend build + frontend tsc
npm run quality          # typecheck + eslint/prettier + tests + schema + submission-check
npm run submission:check # T1–T5 + citations + 500 lookups + enrichment/provenance (+ smoke unless SKIP_SMOKE=1)
npm run demo:preflight   # live API: four stories, T1–T5, corpus picker, versions, bad dates
```

| Suite | What it covers |
|-------|----------------|
| Backend smoke | Modules A–C, T1–T5, exact spans, aliases |
| `honesty.test.ts` / `api_ux.test.ts` | Unknown-over-guess, dual status, envelopes, overrides |
| Frontend Vitest | Status badges, result groups, a11y smoke (vitest-axe), cite client |
| Quality gate | Full CI-shaped bar (`scripts/quality-gate.sh`, also `.github/workflows/ci.yml`) |

---

## Submission pack & scoring

```bash
# Zip for organizers (runs check first)
npm run submission:pack
# → dist/cite-submission-latest.zip
#    rules.json, lookups.json, changes.json, METHOD.md, DEMO.md
```

Organizer auto-grader: when `score.py` ships, copy to `data/pack/score.py` and run `npm run score`. Details: **[docs/organizer-scoring.md](docs/organizer-scoring.md)**.

| Graded component (brief) | Weight | Artifact |
|--------------------------|--------|----------|
| Extraction accuracy | 25 | `outputs/rules.json` |
| Address coverage | 20 | `outputs/lookups.json` |
| Citations | 15 | exact `quoted_span` in corpus |
| Change tracking | 15 | `outputs/changes.json` **T1–T5 only** |

Judge categories (plain language, responsible design, scalability) are separate from `score.py`. **Hour-16 / T6 is not part of this pack.**

---

## HTTP API

Base: `http://localhost:4000` · Contract detail: **[docs/api-ux-contract.md](docs/api-ux-contract.md)** · Schema: `shared/src/index.ts`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + pipeline/schema versions |
| GET | `/version` | Explicit version payload |
| GET | `/addresses?q=&limit=` | Search demo addresses |
| GET/POST | `/lookup/:addressId` | Jurisdiction + rules |
| GET | `/rules` | Extracted rule catalog |
| GET | `/rules/:id/versions` | Version history (`rule_versions.json`) |
| GET | `/changes` / `/changes/:testId` | T1–T5 scenarios |
| GET | `/corpus/docs` | Capturable docs |
| POST | `/extract/doc/:docId` | Live Module A extract (may be slow) |
| GET | `/audit` | Pipeline audit trail (`audit_log.jsonl`) |
| GET | `/submission/:file` | Serve `rules.json` / `lookups.json` / `changes.json` |

### Lookup query / body

| Field | Notes |
|-------|--------|
| `as_of` | Required calendar date `YYYY-MM-DD` (impossible dates → `INVALID_AS_OF`) |
| `include_non_applicable` | `1` / `true` — include explicit `does_not_apply` rows |
| `year_built` / `units` | Session overrides (GET query or POST `building_facts`); not persisted |

### Response extras

- Success (lookup): flat pack fields + `meta`, `warnings[]`, `product_states[]`, `corpus_gaps`, `audit`, `building_facts`
- Errors:

```json
{
  "error": {
    "code": "INVALID_AS_OF",
    "message": "…",
    "user_message": "Enter a valid calendar date in YYYY-MM-DD format.",
    "retryable": false,
    "field_errors": { "as_of": "Invalid calendar date" },
    "request_id": "uuid"
  }
}
```

Common codes: `INVALID_AS_OF`, `ADDRESS_NOT_FOUND`, `ADDRESS_OUT_OF_SCOPE`, `GEOCODING_FAILED`, `NO_RULES_LOADED`, `EXTRACT_FAILED`, `INTERNAL_ERROR`.  
Warning codes include `BUILDING_FACTS_MISSING`, `USER_PROVIDED_FACTS`, `PENDING_NOT_EFFECTIVE`, `CONFLICT_REQUIRES_REVIEW`, `CORPUS_GAP`.

---

## Modules A–C

One-page method: **[docs/method-note.md](docs/method-note.md)** · Data-flow diagram: **[docs/system-architecture.md](docs/system-architecture.md)**

| Module | What runs |
|--------|-----------|
| **A Extract** | Claude (when keyed) + heuristic fallback; Ajv + Zod; `quoted_span` must appear in source; aliases for T1–T5 |
| **B Lookup** | Census Geocoder → legal city/county/state (+ FIPS/GEOID) → deterministic coverage (`applies` / `unknown` / `superseded` / `not_yet_effective` / `pending`) |
| **C Changes** | `dev/change_tests.json` **T1–T5** only — deterministic affected (+ conflict) sets |

### Design choices (short)

- Automated extraction — not hand-transcribed ordinance books
- Layering: confirmed local rent coverage can supersede statewide caps; unresolved local coverage cannot invent supersession
- Soft-gap screening: thin pages may yield low-confidence scaffolds from verbatim FAQ sentences; Newark check-terms stay uncaptured (`corpus_gaps`)
- Version history rebuilt from git snapshots of `rules.json` (`npm run build-versions`)
- Auditability via `audit_log.jsonl` + `GET /audit`

---

## UX architecture

- **Client:** `frontend/src/lib/cite/client.ts` — Zod parse, `CiteApiError`, AbortSignal, fact overrides, `include_non_applicable`
- **Design system:** paper + ink tokens — [`docs/design-system.md`](docs/design-system.md), [`frontend/DESIGN.md`](frontend/DESIGN.md)
- **Status UX:** icon + label + `sr-only` help; confidence is an **extraction band** (high / medium / low), not legal certainty %
- **Grouping:** Appear to apply · Need more facts · Need human review · Do not appear to apply (toggle) · Pending / not yet effective
- **Nav IA:** Lookup → Change scenarios → How it works → Sources; Audit under More; sticky disclaimer + Sources link
- **Baseline / plan / report:** [`docs/ux-audit-baseline.md`](docs/ux-audit-baseline.md) · [`docs/ux-improvement-plan.md`](docs/ux-improvement-plan.md) · [`docs/ux-implementation-report.md`](docs/ux-implementation-report.md)

---

## Offline demo & monitoring

Without `VITE_API_URL`, the UI loads generated corpus snapshots for **all 506** addresses (500 pack + stretch) at fixed dates:

- `2026-10-01`
- `2027-07-02`
- `2027-10-01`

Other dates return an explicit **unavailable** message (not a guess). Rebuild after changing artifacts:

```bash
npm run demo:snapshots
```

- Offline Pipeline shows **saved** corpus extraction, not a live model run.
- Offline fact overrides annotate + warn; they cannot fully re-evaluate coverage like the live API.
- The API badge distinguishes live connectivity from offline / unavailable.
- Scheduled re-checks and customer API webhooks require live Supabase / ops configuration. Delivery is at-least-once; receivers should handle duplicates. Failed persistence or webhook delivery remains due for retry. Re-checks compare stable rule identity, status, conflict flags, and evidence; old status-only baselines refresh once without claiming a legal change.

---

## Known limits

Be ready to say these out loud:

| Limit | Behavior |
|-------|----------|
| Demo address set | Pack 500 + Santa Ana stretch — **not** live free-text geocode for arbitrary US addresses |
| Link-only HOB/JC ordinances | Scaffolds + FAIR Act quotes; applicability `unknown` / scenario |
| Owner type | Unsupported by sample data → correct `unknown` when required |
| Thin / check-terms pages | Some docs stay uncaptured; Lookup may surface `corpus_gaps` |
| Session overrides | Preview only; not saved as official assessor data |
| Offline as-of | Fixed snapshot dates only |
| More-nav SaaS surfaces | Dashboard / inbox / portfolio secondary vs demo path |
| Extract model | Default Haiku; Sonnet for empty-cache / `--retry-failed` |
| `score.py` | Not in pack until organizers ship it — see `docs/organizer-scoring.md` |
| Spanish locale | `en-US`/`es-US` UI + API labels; English quotes remain authoritative; non-template explanations may stay EN with notice |

Audit evidence of gaps closed vs remaining: **[docs/gap-register.md](docs/gap-register.md)** · **[docs/audit-report.md](docs/audit-report.md)** · **[docs/localization/](docs/localization/)**.

---

## Spanish / localization

**Supported languages:** `en-US` (default), `es-US` (U.S. Spanish). Generic `es` is accepted as an alias to `es-US`.

### How to run Spanish mode

1. Start the app (`npm run dev:backend` + `npm run dev:frontend`).
2. Use the header language control (**Español** / **English**), or open a shareable URL with `?lang=es-US` (keeps `address` / `as_of`).
3. Live API: `GET /lookup/A0005?as_of=2026-10-01&locale=es-US` (or `Accept-Language: es-US`).

### Translation-status policy

| Status | Meaning |
|--------|---------|
| `human_reviewed` | Bilingual reviewer approved (none claimed until queue clears) |
| `machine_generated` | Deterministic template Spanish; may show UI badge |
| `untranslated` | English content as-is |
| `not_available` | No safe Spanish template; English shown with notice |

Legal status (`vigente` / `pendiente` / …) is **not** the same as translation status.

### Official-source policy

- Corpus quotations, citations, bill IDs, section numbers, and official titles stay in **English**.
- Spanish UI labels them as **texto legal original en inglés** / authoritative source.
- Automatic Spanish translation of quotes is **disabled** (`informational_translation_es: null`).

### Glossary & human review

- Glossary: [`data/localization/legal_housing_glossary.en-es.json`](data/localization/legal_housing_glossary.en-es.json) · [`docs/localization/LEGAL_HOUSING_GLOSSARY_EN_ES.md`](docs/localization/LEGAL_HOUSING_GLOSSARY_EN_ES.md)
- Review protocol / queue: [`docs/localization/SPANISH_REVIEW_PROTOCOL.md`](docs/localization/SPANISH_REVIEW_PROTOCOL.md) · [`docs/localization/translation_review_queue.json`](docs/localization/translation_review_queue.json)
- Architecture: [`docs/localization/LOCALIZATION_ARCHITECTURE.md`](docs/localization/LOCALIZATION_ARCHITECTURE.md)

### Limitations (Spanish)

- Not legal advice / **No es asesoramiento legal**.
- Not a certified translation and not a substitute for counsel.
- Rule titles/requirements from the English corpus are not auto-translated.
- High-risk strings remain awaiting human review — do not claim certified bilingual legal accuracy.

### Validation

```bash
npm run build -w shared
npm test -w backend -- --test-name-pattern locale
npm test --prefix frontend -- i18n-parity spanish-localization
```

---

## Documentation index

| Doc | Purpose |
|-----|---------|
| [docs/localization/SPANISH_LOCALIZATION_BASELINE.md](docs/localization/SPANISH_LOCALIZATION_BASELINE.md) | Spanish baseline audit |
| [docs/localization/LOCALIZATION_GAP_REGISTER.md](docs/localization/LOCALIZATION_GAP_REGISTER.md) | Localization gaps |
| [docs/localization/SPANISH_LOCALIZATION_IMPLEMENTATION_REPORT.md](docs/localization/SPANISH_LOCALIZATION_IMPLEMENTATION_REPORT.md) | What shipped for ES |
| [docs/method-note.md](docs/method-note.md) | One-page method (extract → geocode → lookup → T1–T5) |
| [docs/demo-script.md](docs/demo-script.md) | ~4 minute judge walkthrough + preflight |
| [docs/system-architecture.md](docs/system-architecture.md) | Stack + Mermaid data flow + failure modes |
| [docs/product-overview.md](docs/product-overview.md) | Product framing and demo story |
| [docs/challenge-brief.md](docs/challenge-brief.md) | Challenge requirements summary |
| [docs/brief-scorecard.md](docs/brief-scorecard.md) | Self-grade against the brief |
| [docs/organizer-scoring.md](docs/organizer-scoring.md) | How `score.py` / auto-grader fits in |
| [docs/lovable-ui-prompt.md](docs/lovable-ui-prompt.md) | Prompt used to build the Lovable frontend |
| [docs/design-system.md](docs/design-system.md) | Paper + ink tokens and status semantics |
| [docs/api-ux-contract.md](docs/api-ux-contract.md) | API meta, warnings, product states, errors |
| [docs/ux-audit-baseline.md](docs/ux-audit-baseline.md) | UX baseline before the overhaul |
| [docs/ux-improvement-plan.md](docs/ux-improvement-plan.md) | Prioritized UX fix plan |
| [docs/ux-test-checklist.md](docs/ux-test-checklist.md) | Demo-day manual acceptance checklist |
| [docs/ux-implementation-report.md](docs/ux-implementation-report.md) | What shipped + browser checklist results |
| [docs/audit-report.md](docs/audit-report.md) | End-to-end audit evidence |
| [docs/gap-register.md](docs/gap-register.md) | Closed gaps and remaining limits |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| UI “Disconnected” / empty live data | Set `VITE_API_URL=http://localhost:4000`, restart Vite; confirm `npm run dev:backend` and `/health` |
| CORS errors | Align `CORS_ORIGIN` with the UI origin; include `http://localhost:8080` (or your Vite port) |
| Lovable can’t reach API | `npm run demo:tunnel` and paste the HTTPS URL as `VITE_API_URL`; re-run preflight |
| `INVALID_AS_OF` | Use a real calendar date `YYYY-MM-DD` (no rollover / impossible days) |
| Nonsense address search | Expected: empty matches + out-of-scope / demo-set hint |
| Frontend install fails on peers | `npm install --prefix frontend --legacy-peer-deps` |
| Tests fail on shared types | `npm run build -w shared` then `npm test` |
| Offline wrong date | Expected unavailable message; regenerate snapshots after pipeline with `npm run demo:snapshots` |
| Sticky disclaimer intercepts clicks | Scroll the control into view (or use keyboard); disclaimer must stay visible by design |
| Quality gate prettier/eslint | `npm run lint --prefix frontend -- --fix --quiet` then `npm run quality` |
| Missing provenance | `npm run write-provenance` |

---

## npm script cheat sheet

| Script | Purpose |
|--------|---------|
| `npm run install:all` | Root workspaces + frontend (`--legacy-peer-deps`) |
| `npm run dev:backend` / `dev:frontend` | Local demo |
| `npm run pipeline` | Full artifact generation |
| `npm test` / `typecheck` / `quality` | Verify |
| `npm run submission:check` / `submission:pack` | Pre-upload |
| `npm run demo:preflight` / `demo:tunnel` / `demo:snapshots` | Pitch readiness |
| `npm run score` | Organizer grader when `score.py` is present |
| `npm run stretch` | Santa Ana stretch path |

---

**Boundary:** Cite provides legal **information** grounded in a fixed corpus and deterministic coverage — not legal advice, not a compliance certification, and not a final legal determination.
