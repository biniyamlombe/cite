# Cite

### Housing law, at an address, on a date — with the quote still attached.

[![CI](https://github.com/biniyamlombe/hacknation702/actions/workflows/ci.yml/badge.svg)](https://github.com/biniyamlombe/hacknation702/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/demo-live-2f6f78?style=flat-square)](https://cite-eight.vercel.app)
[![API](https://img.shields.io/badge/API-healthy-1e3a45?style=flat-square)](https://cite-api-olep35ee2q-uc.a.run.app/health)

**Cite** is a rental-housing law navigator: it extracts rules from a legal corpus, resolves which ones appear to apply at a property, and shows what changes when the calendar moves — every answer carrying a **verbatim citation**.

Built for **Hack-Nation × RealPage · Challenge 02**.

<p align="center">
  <a href="https://cite-eight.vercel.app"><strong>Open the live demo →</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/pitch-deck.html">3-minute pitch</a>
  &nbsp;·&nbsp;
  <a href="docs/method-note.md">method note</a>
</p>

> **Not legal advice.** When the data isn’t there, Cite says **unknown**. It will not invent ordinance text or building facts to look certain.

---

## The punchline

Most tools summarize the law.  
**Cite refuses to answer without the source still in the room.**

| Instead of… | Cite does… |
|-------------|------------|
| Guessing missing year / units | Returns **unknown** |
| Treating postal labels as law | Maps to **Census legal city** |
| Quietly picking a winner in a conflict | Flags **needs human review** |
| Calling pending bills “current” | Keeps them out of **applies** |
| Paraphrasing ordinances | Requires an **exact quoted span** |

---

## See it in sixty seconds

| Beat | Try | What you should notice |
|------|-----|------------------------|
| 1 | Lookup **`A0005`** | Berkeley — missing facts → unknown, not a fake “applies” |
| 2 | Lookup **`A0002`** | Hoboken municipal ban applies + NJ FAIR conflict surfaced |
| 3 | Open **Change Radar** | T1–T5: date flips, city boundaries, conflicts, failed ballot = 0 |

Live app: **[cite-eight.vercel.app](https://cite-eight.vercel.app)**  
Optional stretch: **`SA0001`** (Santa Ana — same pipeline, outside the graded 500)

---

## How Cite works

```
  CORPUS          ADDRESS           CALENDAR
  ──────          ───────           ────────
  extract    →    geocode      →    as-of evaluate
  verbatim        legal city        change tests
  quotes          coverage          conflict flags
       \             |                  /
        \            ▼                 /
         └────►  cited answer  ◄──────┘
```

| Module | Promise |
|--------|---------|
| **A · Extract** | Structured rules from the corpus — every `quoted_span` must appear in the source |
| **B · Resolve** | Jurisdiction stack + deterministic coverage (`applies` / `unknown` / `pending` / …) |
| **C · Track** | Graded scenarios T1–T5 — impact sets you can re-run, not a slide deck of claims |

**UI is display-only.** Legal logic lives in the API and pipeline.

---

## What’s shipping

| | |
|--|--|
| **145** structured rules | six required categories · change-test aliases |
| **500** address lookups | evaluated @ `2026-10-01` |
| **T1–T5** green | `250` · `90` · `140` (+90 conflicts) · `110` · `0` |
| Live stack | Vercel UI · Google Cloud Run API |
| Extras | `en-US` / `es-US` chrome · audit log · Santa Ana stretch · renter check/ask/letter |

---

## Stack

`Hono` · `Vite` / `TanStack` · shared `Zod` contracts · Census Geocoder · Claude extract *(heuristic fallback)*

```
backend/   API + pipeline          frontend/  product UI
shared/    contracts               data/      pack + stretch corpus
outputs/   graded artifacts        docs/      method, pitch, deploy
```

Deploy: [`docs/deploy.md`](docs/deploy.md) · Architecture: [`docs/system-architecture.md`](docs/system-architecture.md)

---

## Run it yourself

```bash
npm run install:all && npm run build -w shared

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# frontend/.env.local → VITE_API_URL=http://localhost:4000

npm run dev:backend      # :4000
npm run dev:frontend     # Vite (often :8080)
npm run demo:preflight   # pitch-day smoke
```

Node **20+**. `ANTHROPIC_API_KEY` optional (re-extract); checked-in `outputs/` already run the demo.

```bash
npm run quality            # CI-shaped gate
npm run submission:check   # citations + T1–T5 + 500 lookups
npm run submission:pack    # organizer zip
```

---

## API at a glance

`https://cite-api-olep35ee2q-uc.a.run.app`

| | |
|--|--|
| `GET /health` | liveness + versions |
| `GET /lookup/:id?as_of=YYYY-MM-DD` | coverage + evidence |
| `GET /changes` | T1–T5 impact |
| `GET /rules` · `GET /audit` | catalog + trail |

Contract: [`docs/api-ux-contract.md`](docs/api-ux-contract.md)

---

## Pitch & docs

| | |
|--|--|
| **3-min pitch** | [`docs/pitch-deck.html`](docs/pitch-deck.html) — Team · Demo · Teach |
| **Speaker notes** | [`docs/pitch-deck.md`](docs/pitch-deck.md) |
| **Judge script** | [`docs/demo-script.md`](docs/demo-script.md) |
| **Method** | [`docs/method-note.md`](docs/method-note.md) |
| **Limits** | [`docs/gap-register.md`](docs/gap-register.md) |

---

## Status

Hackathon prototype with a **production-hosted** demo and checked-in graded artifacts. Scope is the challenge corpus and demo address set — not open-world geocoding.

**Cite the corpus. Say unknown when you must.**
