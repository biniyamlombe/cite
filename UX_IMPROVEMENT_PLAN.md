# Cite — UX Improvement Plan

**Disclaimer:** Legal-information prototype — not legal advice.

## Goals

Make Cite understandable, trustworthy, fast, and accessible for renters, advocates, agencies, and providers — without overclaiming legal certainty.

## Prioritized work

### P0 — Trust & answer clarity

| Item | User problem | Approach | Files | Acceptance |
|------|--------------|----------|-------|------------|
| Trust copy | Hero implies certainty | Rewrite i18n EN/ES; stronger disclaimer | `i18n.tsx`, `index.tsx`, `layout.tsx` | No “guaranteed/protected/compliant”; lead with “appear to apply” |
| Dual status | Status mixed | Separate applicability + legal status badges + icons | `status.tsx`, `rule.tsx` | Both always visible on cards/drawer |
| Rule grouping | Pending looks current | Group sections; never mix pending/NTE into Applies | `index.tsx` | Pending section labeled not current law |
| Confidence | % looks like legal certainty | Band labels only (“extraction confidence”) | `rule.tsx`, `labels.ts` | No percent displayed as certainty |
| API envelope | Opaque failures | meta/errors/warnings + product states | `shared`, `server.ts`, `client.ts` | Typed codes; user_message; request_id |
| Missing facts | Cannot explore unknowns | Panel + session overrides → re-eval | `coverage.ts`, `server.ts`, UI | Override changes unknown→applies/does_not_apply when facts suffice |

### P1 — Completeness

| Item | User problem | Approach | Acceptance |
|------|--------------|----------|------------|
| Nav IA | Sources/Audit hidden | Primary: Lookup, Changes, How it works, Sources; Audit in More | Links present |
| Results summary | Hard to scan | Counts + jurisdiction stack + notices | Summary above rules |
| Non-applicable | Advocates blind | Toggle `include_non_applicable` | Toggle works live/offline |
| Scenario labels | Hypothetical vs law unclear | Explicit banners on Change Radar | T1–T5 labeled |
| Empty/error/loading | Uneven recovery | Shared components + stage copy | Consistent states |
| A11y | Color-only risk | Icons + sr-only + axe smoke | Keyboard + axe pass smoke |
| Perf | Slow repeated lookups | In-memory artifact cache; abort | Cache hit path; cancel works |

### P2 — Timeboxed polish

- Compare/sources polish, More-route i18n, show-more for long lists, optional Playwright.

## Out of scope

Live arbitrary geocode; persisted fact overrides as truth; full More redesign; invented citations.
