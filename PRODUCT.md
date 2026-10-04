# Cite

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start / Vite frontend · Hono API · Tailwind v4 · shared Zod schemas

## Users

Primary: compliance / ops / counsel reviewing which rental-housing rules apply at a multifamily address on a query date.

Demo audience: Hack-Nation × RealPage Challenge 02 judges and PropTech buyers.

Job: answer “what applies here today, and why?” with exact corpus citations; prefer `unknown` over guessing when facts are missing.

Target launch customer: multifamily operators / RealPage-adjacent compliance workflows.

## Product Purpose

Cite turns a public legal corpus into structured rules, geocodes addresses to legal jurisdictions, evaluates coverage, and runs change tests — then shows the answer in a display-only UI.

Success for the live demo: judges complete A0005 → A0065 → A0002 → SA0001 without API failure, and Change Radar T1–T5 stay green.

## Positioning

Meaningfully different mechanism: verbatim `quoted_span` evidence + dual coverage (plain-language text + executable predicates) + honesty callouts (unknown / conflict / open questions / corpus gaps / scenario-only), not freeform legal chat.

## Operating Context

- Default as-of date: `2026-10-01`
- Judge demo path: Lookup → Change Radar → Rules → Pipeline → About
- Live Hono API (`:4000`) with Vite UI via `VITE_API_URL`; UI is display-only (no legal logic in the frontend)
- Offline / mock mode uses corpus-backed snapshots for 506 addresses at `2026-10-01`, `2027-07-02`, and `2027-10-01`
- Submission artifacts: `outputs/rules.json`, `lookups.json`, `changes.json`, plus method/demo docs
- Pack root: `data/pack` (participant-final-no-hour16)

## Capabilities and Constraints

### Capabilities

- Property lookup by address ID or street search (as-of date)
- Rule results with evidence drawer, confidence bands, versions
- Change Radar (T1–T5; T6 hour-16 placeholder)
- Rules / Pipeline / About surfaces for the judge demo
- Stretch jurisdiction (Santa Ana SA0001–SA0006) with visible Lookup badge
- EN/ES chrome locale on primary nav; citations stay in source language
- Monitor (Portfolio / Bulk / Coverage) + Team (Dashboard / Memos / Settings); portfolio defaults to watched set; re-check due status + cron endpoint
- Live API connectivity checks and runtime response validation
- Municipal link-only scenarios retain unknown applicability and `scenario_only` evidence status
- Monitoring distinguishes incomplete checks from unchanged results and compares conflict/source evidence as well as status

### Constraints

- Not legal advice (always visible); not a compliance certification
- No invented ordinance text or building facts
- Pack’s 500 addresses + optional Santa Ana stretch addresses
- Link-only / check-terms primary pages must not invent municipal code
- Unsupported offline as-of dates must fail explicitly

### Undecided

- Organizer submission logistics and hour-16 T6 corpus release timing

## Brand Commitments

- Product name: **Cite**
- Voice: precise, calm, cite-first; no hype verbs
- Incumbent visual world: paper + ink + restrained teal (see `frontend/DESIGN.md` / `frontend/src/styles.css`)
- Binding: refine in place; do not replace the brand world unless explicitly redesigning

## Evidence on Hand

- Starter pack: `data/pack/` (corpus, addresses, schema, change tests)
- Stretch addresses: `data/stretch/santa_ana_addresses.csv`
- Pipeline outputs: `outputs/` (`rules.json`, `lookups.json`, `changes.json`, `geocode_cache.json`, `rule_versions.json`)
- Method / demo: `docs/METHOD.md`, `docs/DEMO.md`
- Offline fixtures: `frontend/src/mocks/snapshots.json`
- Do not fabricate: customer testimonials, non-public RealPage data, ordinance text absent from capturable corpus

## Product Principles

1. **Cite first** — every applicability claim ties to a source document and a verbatim span when capturable text exists.
2. **Unknown over guessing** — missing building facts, uncaptured local pages, and scenario-only scaffolds stay honest.
3. **Display-only UI** — legal evaluation stays in the backend; the frontend renders API results.
4. **Demo path stays calm** — primary nav is the judge story; More holds stretch product surfaces.
5. **Reproducible pipeline** — extract → enrich → geocode → lookup → changes is the system of record for submission.

## Accessibility & Inclusion

- Operable keyboard search (combobox), visible focus, `prefers-reduced-motion`
- Skip link to main content
- EN/ES chrome locale; legal quotes and citations remain in source language
- Honesty / status updates use polite live regions where applicable
