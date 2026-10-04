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
5. Dual `coverage_conditions` ({ text, all, unknown_if, omit_if }) compile/evaluate
6. `outputs/rules.json` exact citations + change-test aliases
7. HOB/JC aliases are honest link-only scaffolds (low confidence, primary URLs in
   `conflict_note`, quoted evidence from capturable D069 only)
8. Rule version history file present; alias keys have newest-first versions

Primary Hoboken / Jersey City ordinance pages are `links_only` in the pack —
tests assert we do **not** invent capturable municipal text for those docs.
