# Spanish localization test plan

## Automated (implemented)

| # | Scenario | Coverage |
|---|----------|----------|
| A1 | EN/ES key parity | `frontend/src/test/i18n-parity.test.ts` |
| A2 | Unknown ≠ does not apply | i18n-parity + glossary asserts |
| A3 | Pending/failed ≠ vigente | i18n-parity |
| A4 | Disclaimer present in ES | i18n-parity |
| A5 | Date formatting en-US/es-US | i18n-parity |
| A6 | Language switch persistence (component) | `spanish-localization.test.tsx` |
| A7 | Source quote authority labeling | spanish-localization.test.tsx |
| A8 | API locale=es-US contract | `backend/src/tests/locale.test.ts` |
| A9 | Invalid locale fallback | locale.test.ts |
| A10 | Protected tokens / unsafe drift | locale.test.ts |
| A11 | Template explanation translation | locale.test.ts |

## Manual / demo checklist

1. **Language switch persistence** — Lookup A0005 with as-of date → switch Español → confirm address/date/results → switch English.  
2. **Supported address** — Spanish UI chrome, Spanish labels, English quote + citation intact, disclaimer visible.  
3. **Unknown / missing facts** — A0002-style unknown: Spanish says cannot determine, lists missing facts.  
4. **Not-yet-effective** — as-of before effective date: Spanish status not “Vigente”.  
5. **Pending / if enacted** — Change Radar T4: hypothetical labeling.  
6. **Failed/struck** — T5: empty affected; not presented as rent cap.  
7. **Conflict** — A0002 / T3: human review wording.  
8. **Errors** — invalid as-of, unknown address (API Spanish user_message when locale=es-US).  
9. **A11y** — keyboard-only switcher; VoiceOver sample on lookup.  
10. **Mobile** — 320 / 375 / tablet: no clipped status chips or CTAs.

## Fixtures

- Glossary: `data/localization/legal_housing_glossary.en-es.json`  
- Review queue: `docs/localization/translation_review_queue.json`  
- Sample rule in spanish-localization test  

## Commands

```bash
npm run build -w shared
npm test -w backend -- --test-name-pattern 'locale|lookup returns meta'
npm test --prefix frontend -- i18n-parity spanish-localization status-badge
```
