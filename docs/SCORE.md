# Scoring drop-in (`score.py`)

This repo uses the **participant-final-no-hour16 / no-scoring** pack. Organizers grade with `score.py` + held-out keys when that pack ships.

## What is graded (auto)

| Component | Weight (brief) | Your artifact |
|-----------|----------------|---------------|
| Extraction accuracy | 25 | `outputs/rules.json` |
| Address coverage | 20 | `outputs/lookups.json` |
| Citations | 15 | exact `quoted_span` in corpus |
| Change tracking | 15 | `outputs/changes.json` T1–T5 (+ T6 when released) |

Judge categories (plain language, responsible design, scalability) are separate from `score.py`.

## Before `score.py` arrives

Keep submission artifacts green:

```bash
npm run submission:check   # T1–T5 shape, 500 lookups, exact citations
npm test                   # fuller smoke suite
npm run score              # prints drop-in instructions until score.py exists
```

Current expectations:

- **T1** = 250 CA addresses (date flip)
- **T2** = 90 (Hoboken + Jersey City; Newark out)
- **T3** = 140 NJ + 90 conflict flags
- **T4** = 110 MA pending
- **T5** = 0 affected (failed ballot)
- **T6** = honest placeholder only (no invented hour-16 results)

## When organizers ship `score.py`

```bash
# Option A — drop into pack
cp /path/to/score.py data/pack/score.py

# Option B — point at it
export SCORE_PY=/path/to/score.py

npm run score
```

Also accepted locations: `data/pack/dev/score.py`, `data/pack/scoring/score.py`, repo-root `score.py`.

`npm run score` tries common CLI flags (`--outputs`, `--output-dir`, positional path, bare) and sets `CITE_OUTPUTS` / `OUTPUTS_DIR`.

## When hour-16 / T6 arrives

1. Add the new Cambridge corpus doc to the pack.
2. `npm run extract` (or extract that doc) → refresh `rules.json`.
3. Confirm `dev/change_tests.json` includes T6 (or update when they ship it).
4. `npm run changes` → real T6 affected set (replace placeholder).
5. `npm run score` if `score.py` is present.
