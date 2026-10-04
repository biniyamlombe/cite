# Cite — Demo script (~4 minutes)

**Disclaimer up front:** Not legal advice.  
**Default as-of:** `2026-10-01`  
**Stack:** API `:4000` · UI (`VITE_API_URL`) · method note `docs/method-note.md`

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

Expect: Connected badge in the UI, `/health` ok, A0005 / A0065 / A0002 / SA0001 lookups 200.

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

Show: Lookup page + as-of date control + Connected badge.

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

### 3 · HOB/JC municipal ordinance + conflict + open question (60s)

**Address:** `A0002` — Hoboken  
**Rule detail:** `HOB-ALG-01` (current `team_rule_id` in Rules / lookup evidence)

Call out:
- Badge **Municipal ordinance** — quote is from the adopted city PDF (`HOB-ORD-01`), not invented ecode360 text
- Pack ecode360 pages stay link-only and unused for quotes; `conflict_note` still lists those primary URLs for review
- Result **applies** in Hoboken (confidence high); Newark correctly excludes the Hoboken ban
- **Conflict / open legal question** on NJ FAIR Act preemption once statewide law is effective (T3)
- Soft-gap contrast (optional): Rules filter → `CAM-FH-01` / `SF-FC-01` show **Soft-gap FAQ** badges (thin pack pages, provisional)

Optional, time travel: in the **Effective-date timeline**, click **Day before** and then **On this date** for July 1, 2027. The backend re-evaluates NJ FAIR (`NJ-ALG-01`), which goes from "Not in effect yet" to "Appears to apply". Open the rule: the **Effective date** proof shows "approved July 20, 2026" + the twelfth-month clause = July 1, 2027, computed from the statute's own words (Change Radar T3 shows the local conflict).

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

“Deterministic tests, not a slide deck.” (Pack is T1–T5 only; hour-16 / T6 removed.)

---

### 5 · Stretch — Santa Ana + confidence + ES (45s)

Search **`SA0001`** (1968, 24 units) vs **`SA0003`** (2018):

- Property summary shows a **Stretch** badge + Santa Ana callout (same pipeline; outside the 500)
- Demo tip on the result: SA0001 applies vs SA0003 15-year just-cause omit
- `SA0001`: Santa Ana rent + just-cause **apply** (+ CA state layering)
- `SA0003`: **15-year** just-cause exemption → that city just-cause rule omitted at the default date
- With the live API, its boundary year (2033) is unknown without the exact production date; by 2040 that particular age exemption has elapsed

Optional beats in the same minute:

- **Rules** → Confidence filter **Low** → soft-gap FAQ badges (`CAM-FH-01` / `SF-FC-01`)
- Toggle **ES** — nav + lookup/changes/rules/about labels translate; citations / quotes stay English-authoritative

---

### 6 · Close (20s)

- Automated extract with **verbatim** `quoted_span`s  
- Reproducible: `npm run pipeline` · `npm test`  
- Limits on **About** / `docs/method-note.md` (soft-gap FAQs, Newark corpus gaps, open questions)

**One-liner:** “Cite won’t invent ordinance text or invent building facts — it cites the corpus and says unknown when the data isn’t there.”

## Offline fallback

Unset `VITE_API_URL` to use the corpus-backed snapshots, then restart the UI. The four demo IDs keep their real pack/stretch facts. Available dates: `2026-10-01`, `2027-07-02`, `2027-10-01`. Pipeline shows saved extraction, and version history comes from the saved artifact. Other dates are unavailable, not guessed. Regenerate with `npm run demo:snapshots` after updating outputs.

Monitor verification: watch A0500 and SA0001; both appear in Portfolio. An unavailable lookup shows incomplete checks and dashes rather than zero exposure. The header distinguishes configured/live connectivity from an unavailable API.
