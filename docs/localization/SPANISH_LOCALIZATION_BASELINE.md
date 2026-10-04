# Spanish localization baseline

**Product:** Cite — Rental Housing Law Navigator  
**Date:** 2026-10-04  
**Locales in scope:** `en-US`, `es-US` (generic `es` accepted as alias → `es-US`)

## Current localization architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | TanStack Start / React | Custom `LocaleProvider` in `frontend/src/lib/i18n.tsx` |
| String catalog | In-module EN/ES tables (~630+ keys) | Not next-intl / react-i18next |
| Persistence | `localStorage` `cite-locale` + URL `?lang=` | Browser language used only when no stored preference |
| Dates | `fmtDate` → `Intl` `en-US` / `es-US` | Long-month textual dates (no MM/DD ambiguity) |
| Backend | Hono API | `locale` query / `Accept-Language`; labels + disclaimer + template explanations |
| Authority | English corpus quotes | Quotes never replaced by Spanish |

## Baseline gaps (pre-implementation)

1. Locales stored as bare `en`/`es` without BCP-47 clarity.
2. Language switcher showed `EN`/`ES` codes only; weak accessible naming.
3. Language not shareable via URL.
4. API explanations/warnings always English.
5. No translation provenance on results.
6. Source quotes not explicitly labeled as English-authoritative in Spanish UI.
7. No controlled glossary or review workflow artifacts.
8. No automated Spanish legal-safety tests.
9. Some hard-coded English remnants (`Before`/`After`, root 404).
10. “Unknown” Spanish label previously “Desconocido” (weaker than approved phrase).

## Existing user flows (renter-facing)

1. Lookup address + as-of date → rule groups → evidence drawer  
2. Change Radar scenarios (T1–T5)  
3. About / sources & limits  
4. Secondary ops surfaces (portfolio, inbox, settings) — chrome translated; ops jargon retained where necessary

## Translation risk analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Unknown → “no aplica” | Blocker | Glossary + automated drift tests + approved label |
| Pending shown as vigente | Critical | Distinct status keys + tests |
| Spanish quote treated as official | Critical | Quote caption + `lang="en"` + no auto quote translation in production |
| Hedge strengthening | Critical | Template translator + unsafe-drift checks |
| Mixed-language results | High | Locale on API + UI plain_language_summary |
| Missing human review | High | Review queue + machine-generated badges |

## Findings by severity (post this pass)

See `LOCALIZATION_GAP_REGISTER.md`. Critical blockers for UI chrome and status labeling are closed or mitigated; corpus titles/requirements and non-template explanations remain English with explicit notices.

## Technical constraints

- Organizer submission enums (`applies`, `unknown`, …) stay English.
- Corpus text is English-only; no official Spanish statutes in pack.
- Offline mock mode does not call live locale translation beyond static UI strings unless fixtures include localized fields.
- Do not send address PII to external MT providers (template i18n is local).

## Remediation priorities

1. Locale strategy + switcher + URL persistence  
2. Status/applicability/disclaimer glossary alignment  
3. API locale contract + provenance  
4. Source-quote authority labeling  
5. Automated QA + human-review protocol  
6. Remaining hard-coded English on secondary/error pages  
