# Cite — Demo script (~4 minutes)

**Disclaimer up front:** Not legal advice.  
**Default as-of:** `2026-10-01`  
**Stack:** API `:4000` · UI (`VITE_API_URL`) · method note `docs/METHOD.md`

## Preflight (90 seconds before judges)

```bash
# Terminal 1 — API
npm run dev:backend

# Terminal 2 — local UI (preferred for reliability)
echo 'VITE_API_URL=http://localhost:4000' > frontend/.env.local
npm run dev:frontend

# Verify critical paths
npm run demo:preflight
```

Expect: Live API badge in the UI, `/health` ok, A0005 / A0065 / A0002 / SA0001 lookups 200.

**Lovable cloud only:** localhost won’t reach your laptop. In a third terminal:

```bash
npm run demo:tunnel
# copy the https://….trycloudflare.com URL into Lovable:
#   VITE_API_URL=https://YOUR-TUNNEL.trycloudflare.com
```

Quick tunnels mint a **new URL every restart** — re-run `demo:preflight` with `VITE_API_URL=https://…` after changing it.

Prefer **local UI + local API** for the pitch if Wi‑Fi is flaky.

---

### 0 · Open (20s)

“Cite answers which housing rules apply at an address *today*, with exact corpus citations — Modules A extract, B geocode/coverage, C change tests.”

Show: Lookup page + as-of date control + Live API badge.

---

### 1 · Module B — missing facts → `unknown` (45s)

**Address:** `A0005` — 1609 Addison St, Berkeley (empty `year_built` / `units`)

Call out:
- Several results are **`unknown`**, not silent `applies`
- Example: statewide COO-age / unit-dependent rules when assessor fields are blank
- “We prefer unknown over guessing.”

---

### 2 · Postal ≠ legal city (30s)

**Address:** `A0065` — 63 Bailey St, Dorchester

Call out:
- Postal city Dorchester → **legal city Boston**
- City rules attach to legal jurisdiction, not the postal label

---

### 3 · HOB/JC honesty + conflict + open question (60s)

**Address:** `A0002` — Hoboken  
**Rule detail:** `HOB-ALG-01` (current `team_rule_id` in Rules / lookup evidence)

Call out:
- Primary Hoboken/JC ordinance pages are **link-only** in the pack
- Confidence **0.35**, conflict flag, `conflict_note` lists primary URLs
- Quoted span is **NJ FAIR Act (D069)** — not invented municipal code
- **Open legal question** chip on NJ FAIR / local overlap (pack §9 preemption)
- Open **Version history** on the Hoboken alias — multiple versions from re-extract/scaffold hardening

Optional: flip as-of toward `2027-07-02` and mention NJ FAIR (`NJ-ALG-01`) NTE → applies + local conflict (Change Radar T3).

---

### 4 · Module C — Change Radar (45s)

Open **Change Radar** / `changes.json` summary:

| Test | Punch line |
|------|------------|
| **T1** | CA alg ban date flip · 250 CA addresses |
| **T2** | HOB vs JC boundary · Newark excluded |
| **T3** | NJ FAIR NTE → applies · HOB/JC conflict flags |
| **T4** | MA pending alg bills |
| **T5** | MA rent ballot failed · affected = 0 |
| **T6** | Hour-16 Cambridge placeholder — no invented results |

“Deterministic tests, not a slide deck.”

---

### 5 · Stretch — Santa Ana (45s)

Search **`SA0001`** (1968, 24 units) vs **`SA0003`** (2018):

- Same pipeline as the pack; addresses live under `data/stretch/` (not in the 500)
- `SA0001`: Santa Ana rent + just-cause **apply** (+ CA state layering)
- `SA0003`: **15-year** just-cause exemption → that city just-cause rule omitted

Optional: toggle **ES** locale — UI chrome translates; citations stay in source language.

---

### 6 · Close (20s)

- Automated extract with **verbatim** `quoted_span`s  
- Reproducible: `npm run pipeline` · `npm test`  
- Limits on **About** / `docs/METHOD.md` (link-only HOB/JC, open questions, empty chrome docs)

**One-liner:** “Cite won’t invent ordinance text or invent building facts — it cites the corpus and says unknown when the data isn’t there.”
