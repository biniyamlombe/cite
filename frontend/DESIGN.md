# Cite — Design system (incumbent)

Editorial “paper + ink” product UI for rental-housing regulatory lookup. Refine in place; do not replace with a new brand world unless explicitly redesigning.

## Mode

**Operate** on Lookup, Change Radar, Pipeline, Rules. Brand lives in precise details (wordmark, citations, status language), not marketing chrome.

## Typography

| Role             | Face                          | Notes                                       |
| ---------------- | ----------------------------- | ------------------------------------------- |
| Display / titles | Source Serif 4 (`font-serif`) | Property address, page titles, quoted spans |
| UI / body        | IBM Plex Sans (`font-sans`)   | Controls, explanations, nav                 |
| Data / IDs       | IBM Plex Mono (`font-mono`)   | Address IDs, dates, confidence, doc IDs     |

Tracking on headings ≈ `-0.015em`. Eyebrows are mono, uppercase, wide tracking — used for section labels in this product (incumbent pattern).

## Color

Warm paper background (`--background` / `--paper`), cool ink foreground (`--ink`). Primary is a restrained teal (`--primary` ~ oklch 0.42 0.07 205).

**Status tokens** (semantic; keep meanings stable):

| Token                          | Meaning                                   |
| ------------------------------ | ----------------------------------------- |
| `applies`                      | Rule applies to property                  |
| `unknown`                      | Missing facts — prefer honesty over guess |
| `superseded`                   | No longer governing                       |
| `future` / `not_yet_effective` | Not yet in force                          |
| `pending`                      | Legislation pending                       |
| `conflict`                     | State/local conflict — human review       |

Soft companions (`*-soft`) are tinted surfaces for chips and callouts.

## Layout

- Max content width ~ `max-w-6xl` (lookup/changes) / `max-w-5xl` (pipeline).
- Surfaces: `surface` utility — light card border + 1px hairline shadow, radius `--radius` 0.375rem.
- Primary nav (judge demo): Lookup → Change Radar → Rules → Pipeline → About. Product extras under **More**.
- Sticky disclaimer: not legal advice.

## Demo-critical patterns

1. **Lookup empty** — labeled demo chips (A0005 unknown, A0065 remap, A0002 conflict).
2. **Postal ≠ legal** — accent callout on property summary when cities differ.
3. **Honesty callouts** — unknown / conflict counts above rule list.
4. **Evidence drawer** — why/conflict → verbatim quote → confidence → versions (expanded by default).
5. **Change Radar** — T1–T5 punch-line strip with affected counts; before→after leads the card.
6. **Pipeline** — staged Source → Validate → Rules; first citation emphasized as verbatim span.

## Motion

Sparse, ease-out: `fade-up` / delays, `chip-stagger` on status chips, `quote-enter` on evidence quotes, `stage-check` / `stage-pulse` on pipeline. All honor `prefers-reduced-motion`.

## Do not

- Purple SaaS gradients, heavy glass, emoji decoration.
- Invent ordinance text or building facts in copy.
- Expand More-nav surfaces into the primary demo path.
