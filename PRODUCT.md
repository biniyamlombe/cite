# Cite

## Platform

web

## Users

Primary: compliance / ops / counsel reviewing which rental-housing rules apply at a multifamily address on a query date (hackathon judges and PropTech buyers as the demo audience).

Job: answer “what applies here today, and why?” with exact corpus citations; prefer `unknown` over guessing when facts are missing.

## Purpose

Cite turns a public legal corpus into structured rules, geocodes addresses to legal jurisdictions, evaluates coverage, and runs change tests — then shows the answer in a display-only UI.

Meaningfully different mechanism: verbatim `quoted_span` evidence + dual coverage (text + executable) + honesty callouts (unknown / conflict / open questions), not freeform legal chat.

## Capabilities

- Property lookup by address ID or street search (as-of date)
- Rule results with evidence drawer, confidence, versions
- Change Radar (T1–T5; T6 placeholder)
- Rules / Pipeline / About surfaces for the judge demo
- EN/ES chrome locale; citations stay in source language
- Responsible design: as-of, unknown-over-guess, conflict/open-question callouts, link-only honesty, not a compliance certification
- Live Hono API or mock client

## Constraints

- Not legal advice (always visible)
- No invented ordinance text or building facts
- Demo path: Lookup → Change Radar → Rules → Pipeline → About
- Pack’s 500 addresses + optional Santa Ana stretch addresses
- Accessibility: operable keyboard search, visible focus, `prefers-reduced-motion`

## Brand commitments

- Product name: **Cite**
- Voice: precise, calm, cite-first; no hype verbs
- Incumbent visual world: paper + ink + restrained teal (see DESIGN.md / `frontend/src/styles.css`)

## Stack

TanStack Start / Vite frontend · Hono API · Tailwind v4 · shared Zod schemas

## Inferred (unconfirmed with user)

- Target launch customer: multifamily operators / RealPage-adjacent compliance workflows
- Success for demo: judges complete A0005 → A0065 → A0002 → SA0001 path without API failure
