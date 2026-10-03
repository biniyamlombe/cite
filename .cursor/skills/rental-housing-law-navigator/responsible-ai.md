# Responsible AI by design

From `corpus/02.pdf` and pack `README.md`. Build for transparency, not legal verdicts.

## The solution should

- Cite the source text and retrieval date for every rule it reports
- Show an “as of” date on every answer (default `2026-10-01`) and separate `in_force` / `not_yet_effective` from `pending` / `failed`
- Say `unknown` when coverage depends on facts it doesn’t have
- Flag conflicts and low-confidence answers for human review
- Explain rules in plain language that a renter can act on
- Keep an auditable log of sources, model outputs and changes

## The solution must not

- Present output as legal advice or a compliance certification
- Suggest ways to avoid, structure around or evade a rule
- Invent rules or citations where the source text is silent (including `links_only` docs)
- Use customer, resident, pricing or other non-public data
- Scrape sites in violation of their terms of use

## UI / copy checklist

- [ ] Persistent “Not legal advice” on lookup and change views
- [ ] As-of date control on every answer
- [ ] Pending / failed never shown as in force
- [ ] Missing parcel facts → `unknown` + which fact is missing
- [ ] Conflict / low-confidence flags visible
- [ ] Citations quote a span present in `corpus/text/`
