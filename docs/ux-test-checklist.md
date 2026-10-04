# Cite — UX Test Checklist (demo day)

**Not legal advice.** Check each item manually before pitching.

**Browser run:** 2026-10-04 · live API `:4000` · UI `:8080` · addresses A0005 / A0065 / A0002

## Primary journeys

- [x] Supported lookup (A0005 / A0065 / A0002) completes with answer summary + grouped rules
- [x] As-of date help text is visible; changing date updates results (live API)
- [x] Jurisdiction stack shows state / county / city; postal ≠ legal callout on A0065
- [x] Applicability and legal status appear as separate badges on rule cards
- [x] Pending / not-yet-effective rules are in their own section, never under “Appear to apply”
- [x] Unknown results explain missing facts; MissingFactsPanel can re-run with year/units (live)
- [x] Conflict / human-review callouts do not prescribe a legal winner
- [x] Evidence drawer shows quote, citation, retrieval date, as-of
- [x] Confidence shows band only (no percent as certainty)
- [x] Toggle “Show rules that do not appear to apply” works (live)
- [x] Audit panel expands with request_id / pipeline_version / product_states
- [x] Change scenarios show scenario vs current-law banner; T5 empty set clear
- [x] Sources & limitations reachable from primary nav and disclaimer bar
- [x] Audit page reachable from More menu

## Failure / recovery

- [x] Nonsense search shows empty matches + out-of-scope hint
- [x] Invalid as-of (if forced) shows user_message, not stack trace
- [x] Offline mock wrong date shows unavailable message
- [x] Retry control works after simulated network error

## Accessibility

- [x] Skip to content works
- [x] Keyboard-only: search combobox, open rule drawer, Escape closes, More menu
- [x] Focus visible on controls
- [x] Status understandable without color (icon + label)
- [x] Screen reader announces loading / errors (spot-check)
- [x] 320px width: lookup usable; tables scroll or collapse

## Responsive / visual

- [x] Desktop max-width composition readable
- [x] Mobile nav opens; disclaimer remains readable
- [x] No hero overclaim (“guaranteed / protected / compliant”)
- [x] Sticky disclaimer still present

## Automated (pre-demo)

```bash
npm test
npm run typecheck
npm run quality   # if time
```

Record pass/fail honestly in `docs/ux-implementation-report.md`.
