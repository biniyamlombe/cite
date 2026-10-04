# Cite — Design System

**Incumbent visual world:** editorial paper + ink. Refine in place; do not replace with a new brand.  
Detailed product notes: [`frontend/DESIGN.md`](frontend/DESIGN.md). Tokens: [`frontend/src/styles.css`](frontend/src/styles.css).

**Not legal advice.** Status colors never stand alone — always pair with icon + text (+ `sr-only` help).

## Typography

| Role | Face | Use |
|------|------|-----|
| Display | Source Serif 4 (`font-serif`) | Addresses, page titles, quoted spans |
| UI | IBM Plex Sans (`font-sans`) | Body, controls, nav |
| Data | IBM Plex Mono (`font-mono`) | IDs, dates, FIPS/GEOID, request IDs |

## Color & status semantics

Warm paper background, cool ink foreground, restrained teal primary.

| Status | Meaning | Icon | Label pattern |
|--------|---------|------|----------------|
| Appears to apply | Coverage appears met | Check | Coverage: Appears to apply |
| Unknown / need facts | Missing building facts | Help circle | Coverage: Unknown |
| Needs human review | Conflict / ambiguity | Alert | Needs human review |
| Does not appear to apply | Coverage unmet / non-operative | X | Coverage: Does not appear to apply |
| Pending / not yet effective | Not current law for as-of | Clock | Legal status: Pending |
| Failed / struck | Not operative | Ban | Legal status: Failed |
| Conflict possible | Overlap flag | Alert | Conflict possible |

Soft companions (`*-soft`) tint chips/callouts. Extraction confidence uses **bands only** (low / medium / high) — never a percent that reads as legal certainty.

## Spacing, radius, motion

- Content width ≈ `max-w-6xl` (lookup) / `max-w-5xl` (pipeline).
- Radius `--radius` ≈ 0.375rem; surfaces use light border + hairline shadow.
- Motion: sparse `fade-up`, chip stagger, quote enter; honor `prefers-reduced-motion`.

## Component inventory (cite)

| Component | Path | Notes |
|-----------|------|-------|
| SiteHeader / DisclaimerBar | `components/cite/layout.tsx` | Scope chip + sticky not-legal-advice |
| StatusBadge / ResultSummaryChips | `components/cite/status.tsx` | Icon + label + sr-only |
| RuleCard / RuleDetailDrawer | `components/cite/rule.tsx` | Dual coverage + legal status |
| MissingFactsPanel | `components/cite/missing-facts.tsx` | Session overrides |
| AuditTrailPanel | `components/cite/audit-panel.tsx` | Request / pipeline meta |
| EmptyState / ErrorState / LoadingSkeleton | `components/cite/states.tsx` | Shared recovery |
| ChangeImpactCard | `components/cite/changes.tsx` | Scenario vs current-law banner |

## Accessibility rules

- Skip link + `main` landmark (root layout).
- Visible focus rings; keyboard on search, drawers, More menu.
- Status never color-only.
- Live regions for loading (`aria-busy` / `aria-live`).
- Reduced motion supported.
- Touch targets ≥ ~40px on primary controls where practical.

## Content guidelines

Prefer: “appear to apply”, “we could not determine”, “based on available public records”, “not current enforceable law”.  
Avoid: guaranteed, compliant, illegal, you are protected, final answer, certain.
