# Rental Housing Law Navigator

Hack-Nation × RealPage · Challenge 02

Address-level housing-law answers with citations: **which rules apply here today, and what is about to change?**

**Not legal advice.**

## Architecture

| Path | Role |
|------|------|
| `backend/` | Anthropic Claude extraction, Census geocoding, coverage engine, change tests, Hono API (`:4000`) |
| `frontend/` | Next.js demo UI (`:3000`) — lookup, changes, live extract |
| `shared/` | Zod schemas shared by FE/BE |
| `data/pack` | Vendored participant starter pack (corpus, addresses, schema, change tests) |
| `outputs/` | `rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json` |

## Setup

```bash
npm install
npm run build -w shared

# Backend env
cp backend/.env.example backend/.env
# Add ANTHROPIC_API_KEY for Claude extraction (optional; heuristic fallback works without it)
# PACK_ROOT is optional; defaults to ./data/pack

# Frontend env
cp frontend/.env.example frontend/.env.local
# For a hosted UI, set NEXT_PUBLIC_API_URL to your backend URL
```

Deploy needs the repo as-is: `data/pack/` + `outputs/` (including `geocode_cache.json`) + backend + frontend. Do not rely on a local Downloads symlink.

## Generate submission outputs

```bash
# Prove organizer sample validates (Zod + Ajv) before extract
npm run check-schema

# Full pipeline (schema gate → extract → geocode → lookup → changes)
npm run pipeline

# Or step by step
npm run extract
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

- UI: http://localhost:3000  
- API: http://localhost:4000/health  

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
| GET | `/submission/:file` | Serve `rules.json` / `lookups.json` / `changes.json` |

## Modules

- **A Extract** — Claude (when keyed) + automated corpus heuristic; Ajv + Zod; `quoted_span` must appear in source text  
- **B Lookup** — Census Geocoder → legal city/county/state → deterministic coverage (`applies` / `unknown` / `superseded` / `not_yet_effective` / `pending`)  
- **C Changes** — `dev/change_tests.json` T1–T5; T6 hook ready for hour-16  

Default query date: `2026-10-01`.
