# Cite

Hack-Nation × RealPage · Challenge 02 — Rental Housing Law Navigator

**Cite** answers: *which housing rules apply at this address today, and what is about to change?* — with exact corpus citations.

**Not legal advice.**

## Architecture

| Path | Role |
|------|------|
| `backend/` | Anthropic Claude extraction, Census geocoding, coverage engine, change tests, Hono API (`:4000`) |
| `frontend/` | Lovable / Vite Cite UI — talks to the Hono API |
| `shared/` | Zod schemas shared by FE/BE |
| `data/pack` | Vendored participant starter pack (corpus, addresses, schema, change tests) |
| `outputs/` | `rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json`, `rule_versions.json` |
| `data/stretch/` | Santa Ana demo addresses (stretch jurisdiction; not in pack 500) |
| `docs/METHOD.md` | One-page method note (extract → geocode → lookup → T1–T5) |
| `docs/DEMO.md` | ~4 minute judge demo script |
| `docs/CITE_LOVABLE_PROMPT.md` | Prompt used to build the Lovable frontend |

## Setup

```bash
# Backend + shared (npm workspaces)
npm install
npm run build -w shared

# Frontend (separate install — Lovable/Vite peer deps break npm workspaces)
npm install --prefix frontend

# Backend env
cp backend/.env.example backend/.env
# Add ANTHROPIC_API_KEY for Claude extraction (optional; heuristic fallback works without it)
# Default model is claude-haiku-4-5. Empty docs / --retry-failed use ANTHROPIC_RETRY_MODEL (Sonnet).
# PACK_ROOT is optional; defaults to ./data/pack

# Frontend env — point at local API
echo 'VITE_API_URL=http://localhost:4000' > frontend/.env.local
```

Or: `npm run install:all`

Deploy needs the repo as-is: `data/pack/` + `outputs/` (including `geocode_cache.json`) + backend + frontend.

## Generate submission outputs

```bash
# Prove organizer sample validates (Zod + Ajv) before extract
npm run check-schema

# Backend + frontend tests (schema, exact spans, coverage, T1–T5, keyboard search, monitoring)
npm test
npm run typecheck

# Full pipeline (schema → extract → dual coverage → geocode → lookup → changes)
npm run pipeline

# Or step by step
npm run extract                 # Haiku default; auto-upgrades empty caches with Sonnet
npm run extract -- --retry-failed   # Sonnet on uncovered capturable docs (merges)
npm run enrich-coverage         # plain-language text + executable predicates
npm run geocode                 # Census Geocoder; add -- --heuristic-only to skip network
npm run lookup                  # default as_of=2026-10-01
npm run changes
```

Outputs land in `outputs/` matching the challenge templates.

Before upload / pitch: `npm run submission:check` (T1–T5 + citations + 500 lookups + smoke) and `npm run demo:preflight` (live API).

Organizer auto-grader: when `score.py` ships, copy to `data/pack/score.py` and run `npm run score`. See [docs/SCORE.md](docs/SCORE.md). Pack is **T1–T5 only** (hour-16 / T6 removed).

Organizer zip (runs check first): `npm run submission:pack` → `dist/cite-submission-latest.zip` (`rules.json`, `lookups.json`, `changes.json`, `METHOD.md`, `DEMO.md`).

API operator console (HTML): open `http://localhost:4000/` while the backend is running.

## Run the demo

```bash
# Terminal 1 — API
npm run dev:backend

# Terminal 2 — UI
echo 'VITE_API_URL=http://localhost:4000' > frontend/.env.local
npm run dev:frontend

# Before pitching
npm run demo:preflight
```

- UI: Vite/Lovable app (check terminal for port, often `http://localhost:8080`)
- API: http://localhost:4000/health
- Lovable cloud: `npm run demo:tunnel` → set that HTTPS URL as `VITE_API_URL`

Set backend `CORS_ORIGIN` to match the UI origin (see `backend/.env.example`). Lovable preview hosts are allowed by default in the API CORS helper.

Judge walkthrough: **[docs/DEMO.md](docs/DEMO.md)** (~4 minutes).

### Demo pages

1. **Lookup** — search sample addresses, set as-of date, see jurisdiction stack + cited rules
2. **Changes** — T1–T5 affected sets and conflict flags
3. **Pipeline** — extract one corpus doc (`D001`, etc.) live

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/addresses?q=` | Search sample addresses |
| GET | `/lookup/:addressId?as_of=` | Jurisdiction + applicable rules |
| GET | `/rules` | Extracted rules |
| GET | `/changes` / `/changes/:testId` | Change-test results |
| POST | `/extract/doc/:docId` | Live Module A extract |
| GET | `/audit` | Extract / test audit trail (`outputs/audit_log.jsonl`) |
| GET | `/submission/:file` | Serve `rules.json` / `lookups.json` / `changes.json` |

## Modules

- **A Extract** — Claude (when keyed) + automated corpus heuristic; Ajv + Zod; `quoted_span` must appear in source text
- **B Lookup** — Census Geocoder → legal city/county/state → deterministic coverage (`applies` / `unknown` / `superseded` / `not_yet_effective` / `pending`)
- **C Changes** — `dev/change_tests.json` T1–T5 (no T6 in this pack)

Default query date: `2026-10-01`.

## Method

See **[docs/METHOD.md](docs/METHOD.md)** for the one-page description of Modules A–C, reproducibility commands, and known limits.

## Offline demo and monitoring

Without `VITE_API_URL`, the UI loads generated corpus snapshots for all 506 addresses at `2026-10-01`, `2027-07-02`, and `2027-10-01`. Other dates return an explicit unavailable message. Rebuild snapshots after changing artifacts with `npm run demo:snapshots`; no browser-side legal evaluation occurs. Offline Pipeline shows saved corpus extraction, not a live model run.

The API badge checks connectivity. Scheduled re-checks and the customer API require live configuration. Re-checks compare stable rule identity, status, conflict flags, and evidence; old status-only baselines refresh once without claiming a legal change. Failed persistence or webhook delivery remains due for retry. Delivery is at-least-once, so receivers should handle duplicate events. The dashboard reports failed runs and refreshed baselines.

`npm run demo:preflight` validates the four demo stories, T1–T5 sets, corpus picker, rule contracts, version history, and rejection of impossible dates. `npm run typecheck` checks all three packages. Tests use simulated webhook/database failures; they do not deliver external messages.
