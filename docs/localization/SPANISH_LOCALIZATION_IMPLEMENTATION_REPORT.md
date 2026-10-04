# Spanish localization implementation report

## Executive summary

Cite already had a large EN/ES UI string table. This pass upgrades it to an explicit **`en-US` / `es-US`** legal-information localization system: shareable language state, glossary-controlled status wording, API locale contract with translation provenance, authoritative English source-quote labeling, deterministic explanation templates with safety checks, automated QA, and human-review artifacts. Spanish support is **assistive and bounded** — not certified translation or legal advice. High-risk strings remain in an awaiting-review queue.

## What was audited

- Frontend i18n catalog (~630 keys), language switcher, date formatting  
- Lookup / rule card / citation panel rendering paths  
- Backend lookup envelope, warnings, explanations  
- Shared schemas and organizer enums  
- Absence of glossary, provenance, and Spanish legal-safety tests  

## What was implemented

1. Canonical locales `en-US`/`es-US` with `es` alias + URL `lang` persistence  
2. Accessible Español/English switcher + SR announcement  
3. Glossary JSON + MD; inventory CSV/MD; gap register; architecture docs  
4. API `locale` support: disclaimer, labels, warnings, plain_language_summary, source_evidence  
5. Template-based Spanish explanations with protected-token + drift guards  
6. Citation panel labels marking English quotes as authoritative  
7. Automated frontend/backend localization tests  
8. Review protocol, QA checklist, test plan, review queue  

## Glossary decisions (selected)

| Term | Decision |
|------|----------|
| unknown | “No se puede determinar” |
| applies | “Parece aplicar” (hedge) |
| in force | “Vigente” |
| not yet effective | “Aprobada, pero aún no entra en vigor” |
| tenant | “persona inquilina” |
| just-cause eviction | “desalojo con justa causa (just-cause eviction)” |
| source quote | Remain English; label authority |

## Translation safety controls

- Separate legal status vs translation status  
- No automatic Spanish quote translation  
- Unsafe drift detection (unknown→no aplica, pending→vigente, may→debe)  
- Risk scoring for high-risk content  
- Machine-generated badge in UI when template ES is shown  

## API / data-model changes

- `API_SCHEMA_VERSION` → `1.3.0`  
- Lookup response: `locale`, `locale_warning`, per-result `plain_language_summary`, `source_evidence`, `translation`  
- Shared modules: `locale.ts`, `translation_safety.ts`  

## Frontend UX changes

- LocaleProvider BCP-47 + URL sync  
- Switcher labels Español/English  
- Spanish status/applicability glossary alignment  
- Rule cards/drawers prefer safe Spanish summaries when available  
- Source quotes captioned as original English authority  

## Accessibility changes

- `aria-label` “Change language” / “Cambiar idioma”  
- `aria-pressed` on locale buttons  
- `aria-live` announcement on language change  
- `html[lang]` set to `en-US`/`es-US`  
- Quotes expose `lang="en"`  

## Tests run and outcomes

```text
npm run build -w shared                          → pass
npm test -w backend -- … locale                  → pass (incl. locale.test.ts + api_ux)
npm test --prefix frontend -- i18n-parity spanish-localization status-badge
                                                 → pass (13/13)
```

Manual browser keyboard/mobile Spanish checks remain recommended for demo day (see test plan § Manual).  

## Unresolved issues

- Root 404/error pages still English (`L12`)  
- Non-template explanations stay English with notice (`L14`)  
- Rule titles/requirements remain English corpus text (`L13`)  
- No bilingual lawyer sign-off yet (`L17`)  

## Content requiring human review

See `translation_review_queue.json` — all high-risk labels/disclaimers/templates awaiting_review; quote translation blocked_by_policy.

## Exact commands for local validation

```bash
npm run build -w shared
npm test -w backend -- --test-name-pattern locale
npm test --prefix frontend -- i18n-parity spanish-localization
```

## Files created and changed

### Created

- `shared/src/locale.ts`  
- `shared/src/translation_safety.ts`  
- `backend/src/api/locale.ts`  
- `backend/src/tests/locale.test.ts`  
- `frontend/src/test/i18n-parity.test.ts`  
- `frontend/src/test/spanish-localization.test.tsx`  
- `data/localization/legal_housing_glossary.en-es.json`  
- `docs/localization/*` (baseline, gap register, glossary MD, architecture, protocols, test plan, inventory, review queue, this report)

### Updated

- `shared/src/index.ts` (exports + schema 1.3.0)  
- `backend/src/api/server.ts`  
- `frontend/src/lib/i18n.tsx`  
- `frontend/src/components/cite/layout.tsx`  
- `frontend/src/components/cite/rule.tsx`  
- `frontend/src/components/cite/status.tsx`  
- `frontend/src/lib/cite/{client,types,labels}.ts`  
- `frontend/src/routes/index.tsx`  
- `README.md`  
