# Cite — UX Audit Baseline

**Product:** Cite (Rental Housing Law Navigator)  
**Audit date:** 2026-10-04  
**Disclaimer:** Legal-information prototype — not legal advice, not a compliance certification.

---

## 1. Architecture summary

| Layer | Tech |
|-------|------|
| Frontend | React 19, TanStack Start/Router/Query, Vite 8, Tailwind 4, shadcn/Radix |
| Design | Paper + ink (`frontend/DESIGN.md`, `frontend/src/styles.css`) |
| Backend | Hono Node API (`backend/src/api/server.ts`), artifact-backed |
| Contracts | Zod (`shared/src/index.ts`) |
| Data | Pack 500 + Santa Ana stretch; `outputs/*.json` |
| Auth | Core API open; Supabase for team/memos/audit history |
| i18n | EN/ES chrome only; legal quotes stay source language |

**Primary demo path:** Lookup → Change Radar → Rules → Pipeline → About  
**Off-nav but real:** `/audit`, `/compare`, `/sources`  
**More menu:** Dashboard, Inbox, Portfolio, Bulk, Coverage, Workspace, Memos, Settings

---

## 2. Baseline user journeys

### A. Address lookup
1. User lands on `/` empty state with demo chips (A0005 unknown, A0065 remap, A0002 conflict).
2. Combobox searches pack addresses via `GET /addresses?q=`.
3. Selection sets URL `?address=&as_of=`; client fetches `GET /lookup/:id`.
4. Results show property summary, status chips, honesty callouts, category-grouped rule cards, evidence drawer.
5. Actions: watch, memo, print, CSV, compare, sources, review case (auth-gated).

**Gaps:** Hero copy overclaims; applicability vs legal status not always dual-labeled; pending/NTE can sit near “applies”; no session fact override re-eval; `does_not_apply` not requested by UI; loading copy implies certainty.

### B. Missing facts
- Unknown results surface missing year/units/owner via callouts and rule warnings.
- Fact correction is Supabase intake only — does not re-evaluate coverage.

### C. Rule detail
- Drawer shows why/conflict, verbatim quote, confidence %, versions.
- Gap: confidence percent reads like legal certainty; legal status vs applicability can collapse into one badge.

### D. Change scenarios
- `/changes` shows T1–T5 with affected counts and before/after.
- Gap: hypothetical vs current-law labeling inconsistent; exclusion reasons under-exposed.

### E. Advocate / audit
- `/audit` is signed-in history; not in nav.
- Lookup response has partial `audit` block; no request_id envelope.

### F. Failure recovery
- Search error vs empty partially tested.
- Thin UX for out-of-scope free text, 409 not-geocoded, offline wrong as-of date.

---

## 3. Problems found (severity)

| ID | Severity | Problem |
|----|----------|---------|
| U01 | High | Overclaiming hero/meta (“Know what applies”) |
| U02 | High | Pending/NTE not forcibly separated from current-law Applies group |
| U03 | High | Missing-facts cannot preview re-evaluation |
| U04 | High | API errors are bare `{ error: string }`; no codes/user_message/request_id |
| U05 | Medium | Applicability and legal status not always shown separately |
| U06 | Medium | Confidence shown as percent |
| U07 | Medium | `include_non_applicable` unused by UI |
| U08 | Medium | Sources/Audit/Compare not discoverable in nav |
| U09 | Medium | Status often color + small label; weak icon/sr-only help |
| U10 | Medium | Per-request full disk reload of rules/addresses/geocode |
| U11 | Low | Secondary pages uneven loading/i18n |
| U12 | Low | No automated axe gate |

---

## 4. Highest-impact improvements

1. Trust language + stronger disclaimer.
2. Grouped results (Applies / Unknown / Review / Does not apply / Pending).
3. Dual status badges + extraction-confidence bands (no %).
4. API envelope + product states + fact overrides.
5. MissingFactsPanel with session re-eval.
6. Nav IA for Sources & Audit.
7. Shared empty/error/loading + a11y tests.

---

## 5. Baseline verification (pre-change)

| Check | Result |
|-------|--------|
| Backend running (`:4000`) | Observed running in local terminal |
| Frontend running (`:8080`) | Observed running in local terminal |
| `GET /lookup/A0005?as_of=2026-10-01` | Previously verified (returns results) |
| Screenshots | Not captured in this baseline (no fabricated images) |

---

## 6. Out of scope (honesty)

- Live free-text Census geocode for arbitrary US addresses.
- Persisting user fact overrides as corpus truth.
- Hour-16 / T6 / organizer `score.py` when absent.
- Full redesign of every More SaaS surface.
