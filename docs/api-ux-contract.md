# Cite — API UX Contract

**Base URL:** `http://localhost:4000` (Hono)  
**Disclaimer:** Legal information prototype — not legal advice.  
**Schema version:** `API_SCHEMA_VERSION` = `1.3.0` (`shared/src/index.ts`)

Lookup responses remain **flat** (fields at the top level) for backward compatibility, with added `meta`, `warnings`, and `product_states`. Errors use a structured envelope.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness + pipeline/schema versions |
| GET | `/version` | Explicit version payload |
| GET | `/addresses?q=&limit=` | Search demo addresses |
| GET | `/lookup/:addressId` | Evaluate coverage |
| POST | `/lookup/:addressId` | Same, with JSON body overrides |
| GET | `/rules` | Rule catalog |
| GET | `/rules/:id/versions` | Version history |
| GET | `/changes` | T1–T5 scenarios |
| GET | `/changes/:testId` | One scenario |
| GET | `/corpus/docs` | Capturable docs |
| POST | `/extract/doc/:docId` | Live extract (may be slow) |
| GET | `/audit` | Pipeline audit log |
| GET | `/submission/:file` | Artifact download |

### Lookup query / body

| Field | Type | Notes |
|-------|------|-------|
| `as_of` | `YYYY-MM-DD` | Required calendar date |
| `locale` | `en-US` \| `es-US` (aliases `en`/`es`) | Localizes disclaimer, labels, warnings, plain-language summaries. Invalid → `en-US` + `locale_warning`. Also accepts `Accept-Language`. |
| `include_non_applicable` | `1`/`true` | Include does_not_apply rows |
| `year_built` | string/number | Session override (not persisted) |
| `units` | string/number | Session override (not persisted) |

POST body may include `{ as_of, locale, include_non_applicable, building_facts: { year_built, units } }`.

**Locale policy:** Enum codes stay English. English `explanation` and `quoted_span` remain authoritative. Spanish plain-language text appears in `plain_language_summary` when a safe template exists; quote auto-translation is not enabled.

## Success shape (lookup)

```json
{
  "disclaimer": "string",
  "as_of": "2026-10-01",
  "address": {},
  "jurisdiction": {
    "status": "resolved",
    "state": "CA",
    "county": "…",
    "city": "…",
    "trusted": true,
    "resolution": "census"
  },
  "building_facts": {
    "year_built": 1975,
    "unit_count": 12,
    "facts_source": "sample_addresses.csv | user_provided",
    "override_fields": ["year_built"]
  },
  "audit": {
    "pipeline_version": "cite-1.1.0",
    "generated_at": "ISO-8601",
    "request_id": "uuid",
    "include_non_applicable": false,
    "user_provided_facts": false
  },
  "meta": {
    "request_id": "uuid",
    "generated_at": "ISO-8601",
    "as_of_date": "2026-10-01",
    "pipeline_version": "cite-1.1.0",
    "schema_version": "1.2.0"
  },
  "warnings": [
    {
      "code": "BUILDING_FACTS_MISSING",
      "message": "developer message",
      "user_message": "user-safe message"
    }
  ],
  "product_states": ["address_resolved", "rules_found", "building_facts_partial"],
  "corpus_gaps": [],
  "results": [
    {
      "team_rule_id": "r-0001",
      "result": "applies",
      "applicability": "applies",
      "legal_status_at_as_of_date": "in_force",
      "status_label": "in_force",
      "applicability_label": "applies",
      "needs_human_review": false,
      "facts_used": [],
      "facts_missing": [],
      "explanation": "…",
      "conflict_flag": false,
      "rule": {}
    }
  ]
}
```

## Error shape

```json
{
  "error": {
    "code": "ADDRESS_NOT_FOUND",
    "message": "Address not found in the supported demo set.",
    "user_message": "That address is not in the supported sample set…",
    "retryable": false,
    "field_errors": {},
    "request_id": "uuid"
  }
}
```

### Error codes

`INVALID_AS_OF`, `ADDRESS_NOT_FOUND`, `ADDRESS_AMBIGUOUS`, `ADDRESS_OUT_OF_SCOPE`, `GEOCODING_FAILED`, `NOT_GEOCODED`, `NO_RULES_LOADED`, `VALIDATION_ERROR`, `EXTRACT_FAILED`, `UNKNOWN_TEST`, `UNKNOWN_RULE`, `NOT_ALLOWED`, `FILE_MISSING`, `INTERNAL_ERROR`

### Warning codes

`SOURCE_UNAVAILABLE`, `JURISDICTION_LOW_CONFIDENCE`, `BUILDING_FACTS_MISSING`, `PENDING_NOT_EFFECTIVE`, `CONFLICT_REQUIRES_REVIEW`, `USER_PROVIDED_FACTS`, `CORPUS_GAP`, `UNTRUSTED_GEOCODE`, `PARTIAL_RESULT`

### Product states

`address_resolved`, `address_ambiguous`, `address_out_of_scope`, `geocoding_failed`, `building_facts_partial`, `rules_found`, `no_rules_found`, `source_unavailable`, `pending_law_only`, `requires_human_review`, `partial_result`, `processing_failed`

## Status mapping (UI)

| Pack `result` | Canonical applicability | UI group |
|---------------|-------------------------|----------|
| `applies` | `applies` (unless conflict → review) | Appear to apply |
| `unknown` | `unknown` / review if conflict | Need more facts / review |
| `pending` / `not_yet_effective` | `does_not_apply` (non-operative) | Pending / not yet effective |
| `superseded` / `does_not_apply` | `does_not_apply` | Do not appear to apply |
| failed rules | omitted or `does_not_apply` when include_non_applicable | Do not appear to apply |

Legal status (`in_force` / `pending` / `not_yet_effective` / `failed`) is always separate from coverage applicability.

## Client

[`frontend/src/lib/cite/client.ts`](frontend/src/lib/cite/client.ts) parses Zod schemas, surfaces `CiteApiError`, passes AbortSignal, and supports fact overrides + `include_non_applicable`.
