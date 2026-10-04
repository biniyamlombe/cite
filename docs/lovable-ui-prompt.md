# Cite — Frontend build prompt (Lovable)

Build a polished, responsive **B2B regulatory-intelligence** web application called **Cite**.

**Cite** helps users answer:

**Which rental-housing regulations apply to this property, why do they apply, and what is about to change?**

**Tagline:** Know what applies. And why.

Emphasize **trust, traceability, citations, and explainability**. The name Cite means every conclusion should be traceable to an underlying legal source — not merely sound correct.

---

## Critical architecture rule

**Do not implement legal decision-making logic in the frontend.**

No geocoding, coverage evaluation, status date math, or affected-address computation in the UI.

The frontend **only displays** results from:

1. A typed API client (preferred for production wiring), or
2. Mock fixtures that **exactly mirror** the Cite API response shapes below.

The real backend is a **Hono TypeScript API** (typically `http://localhost:4000`), not FastAPI. Create a `CiteApiClient` interface plus a `MockCiteApiClient` so swapping to the live API later needs minimal component changes.

**Default as-of date:** `2026-10-01`

**Persistent disclaimer on every page:**

> Not legal advice. Verify important decisions with qualified counsel.

Keep it always visible without overwhelming the UI.

---

## Product philosophy

Surface this in About and empty states:

> AI can help structure regulation. Deterministic systems evaluate applicability. Evidence supports the conclusion.

Every important answer should be easy to trace:

**What applies → Why it applies → What evidence supports it → What could change.**

---

## Design language

Professional **regulatory-intelligence / enterprise SaaS**.

The product should feel:

- Trustworthy
- Precise
- Calm
- Modern
- Technical
- Evidence-driven

Use:

- Generous whitespace
- Excellent typography
- Clear information hierarchy
- Restrained visual treatment
- Subtle icons
- Strong but professional status badges
- Well-designed tables
- Excellent citation presentation
- Desktop-first layout that remains fully responsive

Avoid:

- Excessive gradients
- Glassmorphism
- Decorative AI imagery / robots
- Generic chatbot aesthetics
- Overly playful design
- Purple “AI product” clichés
- Anything that resembles a law-firm marketing site

The product should visually communicate:

**Regulatory infrastructure, not an AI chatbot.**

**Wordmark:** simple typographic **Cite**. Optional minimal motif: quotation marks, brackets, or citation-style references — keep it subtle. No elaborate logo.

---

## Navigation

Clean top navigation:

**Cite**

- Property Lookup
- Change Radar
- Rules
- About

Optional fifth item if it fits without clutter: **Pipeline** (live extract demo).

EN / ES locale toggle is desirable. Keep legal quotations in their source language; translate UI chrome and plain-language labels only.

---

## Real API contracts (design mocks to match these exactly)

### `GET /health`

```json
{
  "ok": true,
  "service": "cite-api",
  "as_of_default": "2026-10-01",
  "disclaimer": "Not legal advice"
}
```

### `GET /addresses?q=&limit=`

Sample multifamily properties (challenge pack has 500). Each row includes:

- `address_id`, `street_address`, `postal_city`, `state`, `zip`, `year_built`, `units`
- `legal_city`, `county` (resolved jurisdiction)

**Important:** `postal_city` is mailing city and is **not always** the legal city (e.g. Dorchester → Boston). Always display the resolved legal jurisdiction when present.

### `GET /lookup/:addressId?as_of=`

```ts
{
  disclaimer: string;
  as_of: string; // YYYY-MM-DD
  address: {
    address_id: string;
    street_address: string;
    postal_city: string;
    state: string;
    zip: string;
    year_built: string;
    units: string;
  };
  jurisdiction: {
    state: string;
    county: string;
    city: string; // legal city
    resolution?: "census" | "known_jurisdiction" | "postal_fallback";
    trusted?: boolean;
  };
  results: Array<{
    team_rule_id: string;
    result: "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending";
    explanation: string;
    conflict_flag: boolean;
    rule: {
      title: string;
      category:
        | "rent_increase_limits"
        | "just_cause_eviction"
        | "security_deposits"
        | "application_screening_fees"
        | "screening_restrictions"
        | "algorithmic_rent_setting";
      citation: string;
      quoted_span: string;
      requirement: string;
      status: "in_force" | "not_yet_effective" | "pending" | "failed";
      level: "state" | "city";
      jurisdiction: string;
      source_url: string;
      source_doc_id?: string | null;
      retrieved_at?: string | null;
      confidence?: number | null;
      effective_date?: string | null;
      coverage_conditions?: string | { text?: string; all?: unknown; unknown_if?: unknown; omit_if?: unknown };
      exemptions?: string | null;
      conflict_note?: string | null;
    } | null;
  }>;
}
```

**Lookup `result` values (exact):**

| Value | UI label |
|-------|----------|
| `applies` | Applies |
| `unknown` | Unknown |
| `superseded` | Superseded |
| `not_yet_effective` | Not yet effective |
| `pending` | Pending |

Rules that do not apply are already omitted by the backend — do not invent “does not apply” rows.

### `GET /changes`

```ts
{
  tests: Array<{
    test_id: "T1" | "T2" | "T3" | "T4" | "T5";
    title: string;
    type: string;
    expected_behavior: string;
    rule_ids: string[];
    as_of?: string;
    as_of_before?: string;
    as_of_after?: string;
  }>;
  results: Record<string, {
    affected_address_ids: string[];
    conflict_flag_address_ids?: string[];
    before_status?: string;
    after_status?: string;
    notes?: string;
  }>;
}
```

### Also available (optional pages)

- `GET /rules` — full extracted rule catalog
- `POST /extract/doc/:docId` — live Module A extract demo
- `GET /submission/:file` — `rules.json` | `lookups.json` | `changes.json`

---

## 1. Property Lookup (primary landing)

This is the main experience.

- Large, prominent search field with messaging:
  **“Enter a rental property address”**
- Search/select by street text or `address_id` (e.g. `A0001`, `Delongpre`) via `/addresses`
- On select, load `/lookup/:addressId?as_of=`

### Property summary

Show:

- Full street address
- Postal city **and** legal city (highlight when they differ)
- Jurisdiction stack: `state › county › city`
- Year built
- Number of units (show em dash when missing — common for some cities)
- Clear **as-of date** control (default `2026-10-01`); changing it re-fetches lookup
- If `jurisdiction.trusted === false`, show a calm warning that legal city is an untrusted postal fallback and city-level rules may be withheld

### Result summary

Compute chips **only from returned `results`** (never invent counts):

- N Applies
- N Unknown
- N Superseded
- N Not yet effective
- N Pending
- N Conflict-flagged

### Rules list

- Group **RuleCard**s by regulatory `category`
- Each card has a clear **StatusBadge** for the lookup `result`
- Make `applies` visually prominent without making warnings alarmist
- For `unknown`, show **UnknownFactWarning** using the backend `explanation` (missing fact). **Never guess.**

The user should immediately understand:

**What applies? Why? What is uncertain? What is changing?**

Polished states: loading, empty search, success, unknown, conflict, API error, no applicable rules.

---

## 2. Rule Detail

When a user selects a regulation, open a detailed drawer/panel/page.

Show (from API fields only):

- Rule title
- Regulatory category
- Jurisdiction + level
- Lookup result + rule status
- Plain-language requirement
- Why the rule applies to this property (`explanation`)
- Property facts displayed (year built, units, legal city) — display only
- Coverage conditions (if object, prefer `.text`; do not execute predicates)
- Exemptions
- Effective date
- Confidence indicator
- Conflict warning when `conflict_flag` / `conflict_note`
- Official legal citation
- Exact quoted source text
- Link to original source
- Retrieval date + as-of date

### Why this applies

Create a prominent section titled **Why this applies**.

Present the backend `explanation` as a clear readable reason. Optional checklist styling is cosmetic only and must not contradict `result`.

If `result === "unknown"`, use:

**Unable to determine**

Then explain the missing fact from the explanation, e.g.:

**Missing property fact: unit count** or **certificate-of-occupancy / year-built ambiguity**

Never imply certainty when the result is unknown.

### Citation experience (brand-critical)

Create a polished **CitationPanel**:

- Official citation
- Source URL
- Exact supporting quotation (`quoted_span`) with expand/collapse
- Retrieval date (`retrieved_at`)
- Analysis as-of date

Visual hierarchy:

**Answer → Reason → Evidence**

---

## 3. Change Radar

Dedicated view for how regulatory changes affect sample properties.

Drive this from `GET /changes` (Module C). Do **not** invent a news feed.

Canonical scenarios:

| ID | Story |
|----|--------|
| **T1** | California AB 325 / SB 763 — `2025-12-31` Not yet effective → `2026-01-02` Applies (CA addresses) |
| **T2** | Hoboken law → Hoboken only; Jersey City law → Jersey City only; Newark → neither |
| **T3** | NJ FAIR Act — `2026-10-01` Not yet effective → `2027-07-02` Applies; conflict flags for Hoboken & Jersey City |
| **T4** | Massachusetts S.2983 and H.5222 — pending; addresses that would be affected if enacted |
| **T5** | Failed MA rent-control ballot — **zero** affected addresses |

For each change, **ChangeImpactCard** shows:

- Rule title / test title
- Jurisdiction
- Status story
- Effective / as-of dates
- Number of affected properties (`affected_address_ids.length`)
- Number of conflicts requiring human review (`conflict_flag_address_ids.length` when present)
- Backend notes

Include a clear **Before → After** comparison when `before_status` / `after_status` exist.

Example:

**December 31, 2025** — Not yet effective  
→  
**January 2, 2026** — Applies

**AffectedPropertiesTable:**

- Address (resolve IDs via `/addresses` or mock join)
- Jurisdiction (legal city / state)
- Before status / after status when provided by the test
- Short reason from notes / expected behavior

Communicate that Cite answers not only **“What applies today?”** but also **“What will change, when, and which properties will be affected?”**

**T6:** omit entirely. The participant-final-no-hour16 pack has no T6; do not invent hour-16 results.

---

## 4. Rules catalog

Browse extracted rules from `GET /rules` (or mocks shaped like it).

- Filter by jurisdiction, category, status
- Open CitationPanel / detail on select
- Useful for trust and judge walkthroughs

---

## 5. About

Short page covering:

- Tagline and product principle
- Disclaimer
- High-level architecture: corpus extract → schema validation → Census jurisdiction → deterministic coverage → change tests → audit log
- Note that demonstration data is not legal advice

---

## Reusable components (required)

- `RuleCard`
- `StatusBadge`
- `CitationPanel`
- `PropertySummary`
- `PropertyFacts`
- `JurisdictionStack`
- `WhyThisApplies`
- `ChangeImpactCard`
- `BeforeAfterStatus`
- `UnknownFactWarning`
- `ConflictWarning`
- `AsOfDate`
- `AffectedPropertiesTable`
- `ResultSummaryChips`
- `DisclaimerBar`

---

## Mock data requirements

Keep all mock data isolated from UI components (e.g. `src/mocks/`).

Use realistic CA / NJ / MA rental-housing examples shaped like the API above, including edge cases:

- Rule clearly applies
- Required property information missing → `unknown`
- Local rule supersedes state → `superseded`
- Pending legislation → `pending`
- Not yet effective, and status flips with as-of date
- State/local conflict flag
- Postal city ≠ legal city
- Change Radar fixtures for T1–T5 (illustrative counts OK in mocks; live API will supply real IDs)

Clearly treat frontend content as **demonstration / mock data**, not real legal advice.

When an env var like `VITE_API_URL` / `NEXT_PUBLIC_API_URL` is present, prefer the live client over mocks.

---

## Out of scope for the frontend

- Census geocoding
- Evaluating coverage predicates
- Recomputing T1–T5 affected sets
- Inventing citations or quoted spans
- Presenting results as compliance certification
- Suggesting ways to avoid or evade a rule

---

## Acceptance checklist

- [ ] Property Lookup is the landing experience
- [ ] Legal city vs postal city is visible when they differ
- [ ] As-of date defaults to `2026-10-01` and refetches lookup on change
- [ ] Status badges use backend enums only
- [ ] Unknown never looks like Applies
- [ ] CitationPanel shows exact quote + source link + retrieval/as-of
- [ ] Change Radar is driven by T1–T5 with Before → After where provided
- [ ] Disclaimer visible on every page
- [ ] API client abstraction; zero legal logic in components
- [ ] Calm enterprise aesthetic — not chatbot / not law-firm brochure
- [ ] Responsive on desktop and mobile

---

## One-line product reminder

**Know what applies. And why.** — with evidence you can open and verify.
