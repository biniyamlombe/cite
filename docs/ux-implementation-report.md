# Cite — UI/UX Implementation Report

**Date:** 2026-10-04  
**Product:** Rental Housing Law Navigator (Cite)  
**Disclaimer:** Legal-information prototype — not legal advice, not a compliance certification, not a final legal determination.

---

## 1. Executive summary

Cite’s demo-critical path was upgraded from a solid honesty baseline into a clearer **answer-first, evidence-always** experience: trust language, dual applicability/legal-status badges, pending laws separated from current-law results, session missing-fact overrides, structured API errors/meta/warnings, shared loading/error states, and discoverable Sources/Audit navigation. Automated backend (18) and frontend (21) tests pass; `npm run typecheck` and browser `docs/ux-test-checklist` pass (see §5a).

---

## 2. What changed

### Frontend
- Trust copy (EN/ES): “appear to apply”, stronger disclaimer, loading stage language.
- Nav IA: Lookup → Change scenarios → How it works → Sources; Audit under More; scope chip.
- Result grouping: Applies / Need more facts / Human review / Does not apply / Pending·NTE.
- Status badges: icon + label + `sr-only` help; dual coverage vs legal status on cards.
- Confidence: extraction bands only (no percent-as-certainty).
- MissingFactsPanel + session re-eval via API overrides.
- AuditTrailPanel; non-applicable toggle; shared Empty/Error/Loading components.
- Change Radar: scenario vs current-law banners.
- Footer trust boundary on lookup results.

### Backend / API
- Structured error envelope (`code`, `user_message`, `request_id`, …).
- Lookup `meta`, `warnings[]`, `product_states[]`, preserved label fields in Zod.
- GET/POST fact overrides (`year_built`, `units`) marked `user_provided`.
- `/version`; health version fields; in-memory artifact cache.
- Coverage engine accepts address overrides.

### Docs
- `docs/ux-audit-baseline.md`, `docs/ux-improvement-plan.md`, `docs/design-system.md`, `docs/api-ux-contract.md`, `docs/ux-test-checklist.md`, README updates, this report.

---

## 3. Accessibility

| Item | Status |
|------|--------|
| Skip link / landmarks | Present (pre-existing + retained) |
| Status not color-only | Icons + text + sr-only on badges |
| Keyboard search | Covered by existing + status tests |
| vitest-axe smoke on status chips | Pass (color-contrast disabled in jsdom — noted in checklist) |
| Reduced motion | Pre-existing CSS honors |

Manual browser checklist completed 2026-10-04 (see §5a). Skip link → `#main-content`; Escape closes rule drawer; mobile Menu expands primary + More links; status chips use icon + label.

---

## 4. Performance

| Item | Change |
|------|--------|
| Artifact reload | In-memory mtime cache for rules/addresses/geocode |
| Lookup cancel | AbortSignal via TanStack Query `signal` |
| Long does_not_apply lists | Show-more after 8 |
| Loading UX | Staged skeleton copy (not fake progress %) |

No formal Lighthouse before/after numbers captured this session.

---

## 5. Tests run and results

Commands:

```bash
npm run build -w shared
npm test                 # backend smoke + node:test + frontend vitest
npm run typecheck
```

| Suite | Result |
|-------|--------|
| Backend smoke (Modules A–C, T1–T5) | Pass |
| Backend `honesty.test.ts` + `api_ux.test.ts` (18) | Pass |
| Frontend Vitest (21, 8 files) | Pass |
| `npm run typecheck` | Pass |
| Live `GET /lookup/A0005` with overrides | Pass (meta + `user_provided` observed) |
| `npm run quality` | Pass (earlier this session) |

### 5a. Browser checklist (live UI + API)

| Check | Result | Notes |
|-------|--------|-------|
| A0005 / A0065 / A0002 answer summary + groups | Pass | Berkeley / Boston postal→legal / Hoboken |
| As-of help + date change | Pass | Help copy visible; A0005 applies 39 @ 2026-10-01 → 27 @ 2025-12-31 |
| Dual Coverage / Legal status badges | Pass | Drawer: “Appears to apply” + “Rule: In force” |
| Pending separated from applies | Pass | Dedicated pending/NTE notices; honesty copy on groups |
| MissingFactsPanel session override | Pass | Year 1975 applied; session banner + Clear session facts |
| Human-review honesty | Pass | “no automated legal conclusion” |
| Evidence drawer | Pass | Quote, citation, as-of, retrieval; Escape closes |
| Confidence bands | Pass | High band; “Not a measure of legal certainty”; no % certainty |
| Non-applicable toggle | Pass | Checkbox reveals “Do not appear to apply” |
| Audit details panel | Pass | `request_id`, pipeline, `product_states` present |
| Change Radar / T5 | Pass | Scenario vs current-law banners; T5 = 0 / ballot failed |
| Sources + Audit nav | Pass | Primary Sources; Audit under More (`/audit`) |
| Nonsense search | Pass | “No matching properties in the supported demo set.” |
| Invalid as-of API | Pass | `INVALID_AS_OF` + `user_message` (no stack) |
| Offline mock wrong date | Pass | Unit: `mockLookup(..., "2030-01-01")` → snapshot unavailable |
| Retry control | Pass* | `RetryButton` wired on lookup error (`onRetry` → refetch); live network fault not injected |
| Skip / keyboard / focus | Pass | `#main-content`; Escape; outline on focus |
| 320px + mobile Menu | Pass | Combobox usable; Menu expands; no horizontal overflow; disclaimer link present |
| No overclaim / sticky disclaimer | Pass | No guaranteed/protected/compliant hero claims |

Sticky disclaimer can intercept mid-page clicks in automation (click Audit via scroll/CDP if needed).

---

## 6. Remaining UX limitations

- No live free-text Census geocode for arbitrary US addresses (pack/stretch only).
- Offline mocks cannot fully re-evaluate coverage after fact overrides (annotation + warning only).
- More-nav SaaS surfaces (dashboard/inbox/portfolio/…) not redesigned to the same depth.
- axe color-contrast not enforceable in jsdom; needs browser checklist.
- Playwright e2e journeys not added (documented as manual checklist items).
- Organizer `score.py` / hour-16 T6 still out of pack scope.

---

## 7. Commands to run

```bash
npm install
npm run build -w shared
npm install --prefix frontend --legacy-peer-deps
echo 'VITE_API_URL=http://localhost:4000' > frontend/.env.local

npm run dev:backend    # :4000
npm run dev:frontend   # often :8080

npm test
npm run typecheck
```

---

## 8. Files created / modified (primary)

**Created:**  
`docs/ux-audit-baseline.md`, `docs/ux-improvement-plan.md`, `docs/design-system.md`, `docs/api-ux-contract.md`, `docs/ux-test-checklist.md`, `docs/ux-implementation-report.md`, `backend/src/api/envelope.ts`, `backend/src/api/cache.ts`, `backend/src/tests/api_ux.test.ts`, `frontend/src/lib/cite/api-error.ts`, `frontend/src/lib/cite/result-groups.ts`, `frontend/src/components/cite/missing-facts.tsx`, `frontend/src/components/cite/states.tsx`, `frontend/src/components/cite/audit-panel.tsx`, `frontend/src/test/result-groups.test.ts`, `frontend/src/test/status-badge.test.tsx`, `frontend/src/test/a11y-lookup.test.tsx`

**Modified:**  
`shared/src/index.ts`, `backend/src/api/server.ts`, `backend/src/apply/coverage.ts`, `frontend/src/lib/cite/client.ts`, `frontend/src/lib/cite/types.ts`, `frontend/src/lib/i18n.tsx`, `frontend/src/components/cite/status.tsx`, `frontend/src/components/cite/rule.tsx`, `frontend/src/components/cite/layout.tsx`, `frontend/src/components/cite/changes.tsx`, `frontend/src/routes/index.tsx`, `frontend/src/test/setup.ts`, `frontend/src/test/cite-data.test.ts`, `frontend/package.json` (+ vitest-axe), `README.md`
