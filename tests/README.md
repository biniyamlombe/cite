# Tests

Run from the repo root:

```bash
npm test
```

Smoke coverage (no Anthropic call required):

1. Organizer `sample_rule_record.json` validates (Zod + Ajv)
2. Corpus loader `loadDocById("D022")`
3. Heuristic extract smoke on D022
4. Invented `quoted_span` is rejected; original span still validates
5. `outputs/rules.json` exact citations + change-test aliases
6. HOB/JC aliases flagged as low-confidence link-only workarounds

Primary Hoboken / Jersey City ordinance pages are `links_only` in the pack —
tests assert we do **not** invent capturable text for those docs.
