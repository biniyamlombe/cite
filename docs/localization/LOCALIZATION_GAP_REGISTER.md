# Localization gap register

| ID | Severity | Category | Location | English content | Spanish status | Risk | Fix | Validation method | Human review required | Final status |
|----|----------|----------|----------|-----------------|----------------|------|-----|-------------------|----------------------|--------------|
| L01 | blocker | Locale strategy | `frontend/src/lib/i18n.tsx` | `en`/`es` only | Mapped to `en-US`/`es-US` | Ambiguous locale / wrong formatting | Canonical BCP-47 + `es` alias documented | unit tests `parseLocale` / i18n parity | no | closed |
| L02 | critical | Language switcher | `layout.tsx` LocaleToggle | EN/ES codes | Español / English labels + a11y | Users cannot find Spanish | Text labels, `aria-label`, live region | spanish-localization.test.tsx | no | closed |
| L03 | critical | Shareable state | URL / localStorage | Locale not in URL | `?lang=en-US\|es-US` | Non-shareable language | Persist lang in URL + storage | manual + unit | no | closed |
| L04 | critical | Applicability | `result.unknown` | Unknown | “No se puede determinar” | Unknown ≠ does not apply | Glossary + string update + tests | i18n-parity.test.ts | yes | closed (provisional) |
| L05 | critical | Legal status | `status.*` | In force / pending / failed | Vigente / Pendiente / Rechazada o anulada | Pending as current law | Distinct labels + tests | i18n-parity.test.ts | yes | closed (provisional) |
| L06 | critical | Source quotes | `CitationPanel` | Quote unmarked | “Texto legal original en inglés” | Fake Spanish authority | Caption + lang=en + notice | spanish-localization.test.tsx | yes | closed |
| L07 | high | API explanations | `backend` lookup | English only | Template ES + provenance | Mixed language / overclaim | `locale` param + `plain_language_summary` | locale.test.ts | yes | mitigated |
| L08 | high | API warnings | `envelope.ts` / `locale.ts` | English user_message | Spanish map for `es-US` | English errors in Spanish UI | Localized warning strings | locale.test.ts | yes | mitigated |
| L09 | high | Provenance | API results | None | translation status fields | Untagged MT | Schema + response fields | LookupResponseSchema | no | closed |
| L10 | high | Glossary | docs/data | Absent | Glossary JSON+MD | Inconsistent terms | Controlled glossary v1.0.0 | glossary tests | yes | closed (provisional) |
| L11 | medium | Dates | `fmtDate` | en vs es | es-US long month | Ambiguous numeric dates | Intl long month | i18n-parity.test.ts | no | closed |
| L12 | medium | Hard-coded EN | `__root.tsx` 404/error | Page not found | Still English | Mixed language | Defer / follow-up | manual | no | open |
| L13 | medium | Rule titles | corpus / rules.json | English titles | Untranslated | Expected for corpus | Keep EN; UI labels translated | policy | yes | accepted |
| L14 | medium | Non-template explanations | coverage edge cases | English | `not_available` + EN shown | Incomplete ES | Expand templates / human queue | locale.test.ts | yes | open |
| L15 | medium | Quote MT | product policy | N/A | Disabled (`informational_translation_es: null`) | Hallucinated quotes | Do not auto-translate quotes | API assert | yes | closed (by design) |
| L16 | low | Secondary SaaS chrome | settings/webhooks | English jargon | Partial | Ops users | Keep identifiers; chrome ES | inventory | no | accepted |
| L17 | high | Human review | process | None | Protocol + queue JSON | Unreviewed high-risk publish | Review protocol docs | checklist | yes | open (process) |
| L18 | medium | Root a11y announce | LocaleProvider | None | aria-live language change | SR silence | Live region | manual SR | no | closed |

## Legend

- **closed (provisional):** Implemented with glossary-approved copy; still needs bilingual legal reviewer sign-off before claiming certified translation quality.
- **mitigated:** Safe fallback exists; coverage incomplete.
- **accepted:** Intentional English retention (authority / identifiers).
- **open:** Remaining work.
