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
| `outputs/` | `rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json` |
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
# Default model is claude-haiku-4-5 (cheapest/fastest). Override with ANTHROPIC_MODEL.
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

# Smoke tests (schema, corpus loader, citation spans, aliases, T1–T5)
npm test

# Full pipeline (schema → extract → dual coverage → geocode → lookup → changes)
npm run pipeline

# Or step by step
npm run extract
npm run enrich-coverage         # plain-language text + executable predicates
npm run geocode                 # Census Geocoder; add -- --heuristic-only to skip network
npm run lookup                  # default as_of=2026-10-01
npm run changes
```

Outputs land in `outputs/` matching the challenge templates.

## Run the demo

```bash
# Terminal 1 — API
npm run dev:backend

# Terminal 2 — UI
npm run dev:frontend
```

- UI: Vite/Lovable app (check terminal for port, often `http://localhost:8080`)
- API: http://localhost:4000/health

Set backend `CORS_ORIGIN` to match the UI origin (see `backend/.env.example`).

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
- **C Changes** — `dev/change_tests.json` T1–T5; T6 hook ready for hour-16

Default query date: `2026-10-01`.
