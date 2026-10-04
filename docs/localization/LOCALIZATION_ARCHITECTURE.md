# Localization architecture

## Locale strategy

- Supported: **`en-US`**, **`es-US`**
- Aliases: `en` → `en-US`; `es` and other `es-*` → `es-US` (documented fallback)
- Invalid locale → `en-US` + `locale_warning` on API

## Route / state persistence

1. Explicit user choice stored in `localStorage` key `cite-locale`
2. Shareable query param `lang=en-US|es-US` kept in sync via `history.replaceState`
3. Lookup also keeps `address`, `as_of`, `rule` — language switch must not clear them
4. Browser `navigator.language` used **only** when no stored preference and no URL lang

## Translation file organization

- UI catalog: `frontend/src/lib/i18n.tsx` (paired `en` / `es` tables)
- Glossary: `data/localization/legal_housing_glossary.en-es.json` + MD mirror
- Backend label/disclaimer maps: `shared/src/locale.ts`, `backend/src/api/locale.ts`
- Safety helpers: `shared/src/translation_safety.ts`

## Backend localization contract

```
GET /lookup/:id?as_of=YYYY-MM-DD&locale=es-US
Accept-Language: es-US
```

Response additions:

- `locale`, `locale_warning`
- Localized `disclaimer`, warning `user_message`, `status_label`, `applicability_label`
- Per-result:
  - `explanation` — original English (authoritative plain-language source)
  - `plain_language_summary` — localized text + translation_status
  - `source_evidence.official_quote_en` — immutable English quote
  - `source_evidence.informational_translation_es` — currently always `null`
  - `translation.status` / `requires_human_review`

Enums (`result`, `applicability`, `legal_status_at_as_of_date`) stay language-neutral.

## Translation metadata / provenance

Internal shape (see `TranslationMetaSchema` in `shared/src/locale.ts`):

- `translation_status`: human_reviewed | machine_generated | untranslated | not_available | …
- `authoritative_language`: always `en` for legal evidence
- hashes, glossary_version, translation_policy_version
- Provider/model fields retained for audit; UI shows only safe badges

## Caching / invalidation

- Template translations are deterministic (no external cache yet).
- Invalidate / bump when `GLOSSARY_VERSION` or `TRANSLATION_POLICY_VERSION` changes.
- Future external MT cache keys must include: source hash, locale, glossary version, model, policy version.
- Never send full street addresses to external MT — send only explanation templates.

## Glossary enforcement

- Critical labels pulled from glossary-approved UI strings
- Automated tests assert unknown/pending/failed wording
- Prohibited translations listed in glossary JSON

## Source quote policy

1. Always show English `quoted_span` with `lang="en"`
2. Label: “Texto legal original en inglés” / “Original English legal source text”
3. Do **not** ship automatic quote translation (`informational_translation_es: null`)
4. If quote translation is ever enabled: informational notice required + human review for high risk

## AI translation safeguards

- Prefer deterministic templates over free-form LLM translation
- Protected-token protect/restore for IDs, URLs, dates, citations
- Risk scoring + unsafe status drift rejection
- Corpus text treated as untrusted data (templates do not execute source instructions)
- High-risk outputs flagged `requires_human_review`

## Fallback behavior

If Spanish translation unavailable:

1. Keep UI chrome in Spanish
2. Show English explanation with “Spanish translation unavailable…” notice
3. Keep English quote
4. Do not fabricate Spanish legal text

## Human-review workflow

See `SPANISH_REVIEW_PROTOCOL.md` and `translation_review_queue.json`.
