# Challenge ask vs Cite implementation

Hack-Nation × RealPage · Challenge 02 — Rental Housing Law Navigator  
Pack: `data/pack` ≡ `participant-final-no-hour16` (byte-identical to organizer drop) · Product: **Cite**

**Not legal advice.**

---

## 1. What the question asks

From `data/pack/README.md` (Participant Guide):

> For any apartment address in the sample, your system must answer: **which housing rules apply here on the query date, and how do the supplied change cases affect the answer?**

Default query date: **`2026-10-01`**.

### Modules (required)

| Module | Ask |
|--------|-----|
| **A — Extract** | Read the supplied corpus automatically; turn each rule into a structured record with **source citation**, **verbatim quoted span**, and **retrieval date**. Not hand-coded rules. |
| **B — Apply** | Resolve each address to **legal jurisdiction** (postal city ≠ legal city); evaluate coverage; return `applies` / `unknown` / `superseded` / `not_yet_effective` / `pending`. Prefer **unknown** over guessing when facts are missing. |
| **C — Changes** | For each supplied change test (**T1–T5 only**), report which addresses are affected (and conflict flags where required). |

### Hour-16 / T6

Organizers **removed** the hour-16 Cambridge scenario from this pack (`participant-final-no-hour16`).  
`dev/change_tests.json` lists **T1–T5 only**. Do not invent T6 results.

### Minimum viable submission

1. Modules A and B on the sample addresses (accurate extract, jurisdiction, citations first).
2. Module C + plain-language view next.
3. Stretch (Spanish, confidence, new jurisdiction) only after that.

### Submission artifacts

| File | Requirement |
|------|-------------|
| `rules.json` | Rule records matching `schema/rule_record.schema.json` |
| `lookups.json` | All **500** addresses at `as_of: 2026-10-01` |
| `changes.json` | **T1–T5** affected (+ conflict) sets |

### Change tests (T1–T5)

| Test | Ask |
|------|-----|
| **T1** | CA AB 325 / SB 763 date flip: 2025-12-31 vs 2026-01-02 |
| **T2** | Hoboken vs Jersey City local algorithmic bans; Newark correctly out |
| **T3** | NJ FAIR Act not yet effective now / applies later; conflict with Hoboken & Jersey City |
| **T4** | MA pending bills (S.2983, H.5222) — who would be affected if enacted |
| **T5** | Failed MA rent-control ballot — affected set **empty**; never treat as in force |

### Responsible design (Do / Don’t)

**Do:** cite source + retrieval date; show as-of; separate pending from enacted; say unknown; flag conflicts; keep an audit log.  
**Don’t:** present as legal advice; suggest avoidance; invent rules/citations; use non-public data.

### Stretch / bonus (optional)

- Spanish UI
- Confidence indicators
- New jurisdiction (e.g. Santa Ana — laws in corpus, no pack addresses)
- Surface pack §9 open legal questions

---

## 2. What Cite implements today

### Pack sync

`data/pack` was verified **byte-identical** to the organizer folder  
`~/Downloads/participant-final-no-hour16` (65 files; same README, corpus, schema, `change_tests.json`, templates, PDF).

### Backend pipeline

```bash
npm run pipeline   # schema → extract → enrich → geocode → lookup → changes
npm run submission:check
```

| Step | Module | Implementation |
|------|--------|----------------|
| Schema gate | — | Zod + Ajv on pack sample |
| Extract | A | Claude over capturable docs; heuristic fallback; spans must match corpus verbatim |
| Enrich | A/B | Dual coverage; aliases for change tests |
| Geocode | B | Census Geocoder (+ cache); legal city vs postal |
| Lookup | B | All 500 addresses; honesty callouts |
| Changes | C | **T1–T5 only** (no T6 emission) |

### Current submission artifacts (`outputs/`)

| Artifact | Status |
|----------|--------|
| `rules.json` | ~147 rules |
| `lookups.json` | **500** addresses · `as_of` 2026-10-01 |
| `changes.json` | T1=250 · T2=90 · T3=140 (+90 conflicts) · T4=110 · T5=0 · **no T6** |

### Product UI (judge path)

Lookup → Change Radar (T1–T5) → Rules → Pipeline → About  
Plus Monitor/Team stretch under More.

### Stretch shipped

EN/ES chrome · confidence bands · Santa Ana stretch · open questions · link-only honesty · re-checks / watchlist / memos

---

## 3. Ask → implementation matrix

| Challenge ask | Cite status |
|---------------|-------------|
| Automated Module A extract + citations | **Done** |
| Module B geocode + coverage + unknown | **Done** |
| Module C T1–T5 | **Done** |
| 500 lookups @ 2026-10-01 | **Done** |
| No invented T6 / hour-16 | **Done** (T6 omitted) |
| As-of, disclaimer, audit | **Done** |
| Spanish / confidence / Santa Ana | **Done** (stretch) |
| Organizer `score.py` | **Drop-in ready** when file arrives |

---

## 4. Still waiting on organizers

1. **`score.py` + held-out keys** — see `docs/SCORE.md`.
2. **Submission logistics** — deadline, upload channel, licensing (TBD in pack §3).

---

*Ask: `data/pack/README.md`. Method: `docs/METHOD.md`. Artifacts: `outputs/`.*
