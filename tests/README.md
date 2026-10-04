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
9. Stretch Santa Ana: demo addresses + city rules apply; pack 500 unchanged

Primary Hoboken / Jersey City ordinance pages are `links_only` in the pack —
tests assert we do **not** invent capturable municipal text for those docs.

## Regression checks

`npm test` runs the existing smoke suite, backend `node:test` regressions in `backend/src/tests/`, and frontend Vitest tests in `frontend/src/test/`. Tests cover calendar validation, rolling-year boundaries, uncertain precedence, municipal scenario honesty, Hono routes, extraction fallback validation, corpus-backed offline data, keyboard search, partial monitoring failures, and webhook/database failures. Webhook calls are stubbed.

Run `npm run typecheck` for all packages and `npm run demo:preflight` against a running API for semantic checks of A0005 → A0065 → A0002 → SA0001. A full visual/assistive-technology walkthrough remains a separate manual check.
