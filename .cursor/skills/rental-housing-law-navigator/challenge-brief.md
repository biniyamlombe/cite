# Challenge brief (from corpus/02.pdf)

Hack-Nation × RealPage — Challenge **02** — Rental Housing Law Navigator · October 2026.

Source of truth for narrative/scope: `corpus/02.pdf`. Ops detail: pack `README.md`.

## Goals and motivation

Rental Housing Law Navigator is an AI system that reads public housing law and answers one question for any apartment address: **which rules apply here today, and what is about to change?**

**THE QUESTION:** How might AI turn thousands of pages of state and local housing law into accurate, cited, address-level answers that renters, advocates, housing agencies and housing providers can trust?

Rental housing in the U.S. is regulated in layers: state statutes, county rules and city ordinances, each with its own coverage tests (building age, unit count, owner type), effective dates and exemptions. The answer depends on the exact address, and it changes often.

- **14** cities and counties across 8 states have enacted local bans on algorithmic rent-setting since late 2024, most with different definitions and penalties.
- **Jan 2026** — California’s amended antitrust law on common pricing algorithms (AB 325 / SB 763) took effect, adding a state layer on top of the local ones.
- **Jun 2026** — Massachusetts’ high court removed a statewide rent-control question from the November ballot. Proposed changes don’t always become law, and tools must know the difference.

### Who this helps

| Audience | Value |
|----------|--------|
| Renters | Rights at their address: rent increase limits, deposit caps, fee rules, eviction protections |
| Advocates & agencies | Which protections cover which buildings, and what a pending bill would change |
| Housing providers | Especially small owners without legal teams: understand obligations before they act |

### Challenge in one line

In 24 hours, build a working system that extracts rules from a provided corpus of real housing law, resolves any sample address to the rules that apply to it with citations, and shows which addresses a law change affects.

## What teams build

Three required modules plus stretch goals, on the provided starter pack.

| # | Module | Job |
|---|--------|-----|
| 1 | Extract | Statutes and ordinances → structured rule records (provided schema) |
| 2 | Resolve | Geocode address → jurisdiction stack: state, county, city |
| 3 | Apply | Test coverage conditions against building facts: year built, units, owner type |
| 4 | Explain | Every applicable rule with plain-language summary + citation |
| 5 | Track change | New or pending law → addresses affected and what changes |

**Module A (required):** Agent reads each corpus document → one JSON record per rule. Automated, not hand-coded: category, jurisdiction, requirement, coverage conditions, exemptions, effective date, status (enacted or pending in brief language; pack schema uses `in_force` / `not_yet_effective` / `pending` / `failed`), penalty, source citation and quoted span.

**Module B (required):** Given an address, return jurisdiction stack and every applicable rule. Local override of state must be stated. Missing facts → “unknown”, not guess.

**Module C (required):** Run provided change test cases. List affected sample addresses and before/after rule set; support “as of date” query.

### Stretch goals

- Renter-facing plain-language view in English and Spanish
- Confidence score and conflict flag for each answer
- Extend to one new jurisdiction live during the event

## Illustrative output (not the answer key)

Address lookup · as of Oct 1, 2026 — Sample: 20-unit building in San Francisco, built 1962. Jurisdictions: California › City & County of San Francisco

- **RENT INCREASES** — SF Rent Ordinance applies (certificate of occupancy on or before 6/13/1979); the AB 1482 state cap yields to it. S.F. Admin. Code ch. 37 · Cal. Civ. Code §1947.12
- **JUST CAUSE** — Eviction only for listed causes. S.F. Admin. Code §37.9 · Cal. Civ. Code §1946.2
- **DEPOSIT** — Capped at one month’s rent (small-landlord exception does not apply at 20 units). Cal. Civ. Code §1950.5 (AB 12, eff. 7/1/2024)
- **SCREENING FEE** — Capped at a CPI-adjusted amount; no fee if no unit is available. Cal. Civ. Code §1950.6
- **ALGORITHMIC PRICING** — Local ban + state restrictions. S.F. Admin. Code §37.10C (Oct 2024) · AB 325 / SB 763 (eff. 1/1/2026)

## Scope for 24 hours

3 states · 10 cities · 6 rule categories

| State | Cities | Why |
|-------|--------|-----|
| California | Los Angeles, San Francisco, San Diego, Berkeley, Santa Ana* | Densest layering: statewide rent cap and just cause, local rent control, statewide and local algorithmic-pricing rules with different effective dates |
| New Jersey | Jersey City, Hoboken, Newark | Rent control city by city; statewide eviction, screening and fee rules; two local algorithmic bans; FAIR Act (effective July 2027) that may preempt them |
| Massachusetts | Boston, Cambridge | State bars local rent control; 2026 ballot question struck; algorithmic-pricing bills pending — systems must avoid reporting rules that don’t exist |

\*Santa Ana laws are in the corpus for extraction, but no open parcel data with addresses exists, so the address sample covers the other 9 cities.

## Rule categories (schema enums)

| # | Category (schema) | Capture | Corpus examples |
|---|-------------------|---------|-----------------|
| 1 | `rent_increase_limits` | Cap formula, covered buildings, exemptions, local vs state precedence | CA Civ. Code §1947.12; SF Admin. Code ch. 37; LA RSO; MA G.L. c.40P |
| 2 | `just_cause_eviction` | Allowed causes, notice, relocation, coverage | CA Civ. Code §1946.2; NJ N.J.S.A. 2A:18-61.1 |
| 3 | `security_deposits` | Maximum, exceptions, effective date | CA Civ. Code §1950.5 (AB 12); NJ N.J.S.A. 46:8-21.2; MA G.L. c.186 §15B |
| 4 | `application_screening_fees` | Fee caps, upfront charges, receipts/refunds | CA Civ. Code §1950.6; NJ P.L.2025 c.405; MA G.L. c.186 §15B; MA broker-fee G.L. c.112 §87DDD½ |
| 5 | `screening_restrictions` | Criminal-history and income-source limits; timing | NJ Fair Chance in Housing Act; CA FEHA SB 329 |
| 6 | `algorithmic_rent_setting` | Covered software, prohibited conduct, penalties, effective date | CA AB 325/SB 763; SF §37.10C; San Diego §§98.1101–98.1104; Berkeley ch. 13.63; Santa Ana Ord. NS-3090; Jersey City §218-12; Hoboken ch. 158 Art. II; NJ FAIR Act; MA S.2983 / H.5222 |

Answer key (judges): 58 rules + 19 “no rule at this level”; 52/58 verified as of Oct 1, 2026. Not reviewed by counsel. Not legal advice.

## Change-tracking test cases (02.pdf)

| ID | Case | Correct behavior |
|----|------|------------------|
| T1 | CA AB 325 / SB 763, effective 1/1/2026 | `not_yet_effective` for CA as of 12/31/2025; `applies` as of 1/2/2026 |
| T2 | Hoboken and Jersey City local bans | Each ban only inside its own city; neither in Newark |
| T3 | NJ FAIR Act, signed 7/20/2026, effective 7/1/2027 | `not_yet_effective` today; `applies` on 7/2/2027; flag possible conflict with the two local bans |
| T4 | MA S.2983 and H.5222 (pending) | Report as pending, never in force; list addresses they would affect |
| T5 | MA rent-control ballot, struck 6/23/2026 | No rent cap for Boston or Cambridge; affected set empty |
| T6 | Fictional Cambridge ordinance (hour 16) | Extract unaided; list affected addresses; correct future effective date |

Pack `dev/change_tests.json` currently includes **T1–T5** with concrete rule_ids and dates. T6 ships mid-event.

## Starter pack (02.pdf summary)

| Item | Contents |
|------|----------|
| Law corpus | 87 source documents; official text + URL + retrieval date; law-firm/news as links only |
| Sample addresses | ~500 multifamily in 9 cities; street, postal city, ZIP, year built, units, use code; no owner names |
| Rule schema | Required fields, 6 categories, worked sample |
| Dev answer key | 10 rules + 20 addresses (when provided) |
| Held-out key | 58 rules, 19 “no rule”, 100/500 addresses — judges |
| Change tests | T1–T6; expected affected sets held by judges |
| Scoring script | `score.py` — judges’ script (when provided) |

## Public sources (allowed)

State codes (CA, NJ, MA); municipal codes via starter corpus (bulk scraping often restricted); LegiScan; Open States; Census Geocoder / TIGER/Line; public parcel data; LA RSO / SF Rent Board for validation only; LSC Eviction Laws DB for methods only (as of 1/1/2021).

**Not provided / not allowed:** customer or resident data, rent or pricing data, internal legal analysis, scraping that violates a site’s terms of use.

## 24-hour plan (02.pdf)

| Hours | Activity |
|-------|----------|
| 0–1 | Kickoff, starter-pack walkthrough, mentor intros |
| 1–6 | Rule extraction; self-check on the dev key |
| 6–11 | Geocoding, jurisdiction stacks, coverage logic |
| 11–16 | Address lookup with citations and plain-language view |
| 16–20 | Change tracking; synthetic ordinance at hour 16 |
| 20–23 | Scoring run, fixes, demo prep |
| 23–24 | Demos and judging |

## Rules & submission (02.pdf)

**Rules:** MVP = Modules A and B on the dev set · automated extraction only (hour-16 + live demo check) · “unknown” earns credit · no non-public data / no terms-violating scrape · every interface says “not legal advice.”

**Submit:** `rules.json` · `lookups.json` (all 500 addresses; results: applies, unknown, superseded, not yet effective, or pending — pack uses snake_case `not_yet_effective`) · `changes.json` · three videos with scores · GitHub · live demo link.

**Videos must show:** `score.py` on the dev set · T1–T6 · hour-16 ordinance processing.

## Scoring weights (02.pdf)

Extraction 25 · Address coverage 20 · Citations 15 · Change tracking 15 · Plain language/usability 10 · Responsible design 10 · Scalability 5.
