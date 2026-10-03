# Starter pack facts (participant guide + files)

Pack: `participant-final-no-hour16/`  
Guide: pack `README.md` · Brief: `corpus/02.pdf`

**Default query date: `2026-10-01`.**

## Paths

```
participant-final-no-hour16/
├── README.md                          # participant guide (ops)
├── mit-rental-housing-law-navigator-challenge-v5-participant-no-scoring-no-hour16.pdf
├── corpus/
│   ├── 02.pdf                         # challenge brief
│   ├── corpus_manifest.csv            # 87 rows
│   ├── links_only.csv
│   └── text/D001.txt … D085.txt       # captured official text
├── data/sample_addresses.csv          # 500 rows
├── schema/
│   ├── rule_record.schema.json
│   └── sample_rule_record.json
├── dev/change_tests.json              # T1–T5
└── submission_templates/
    ├── rules.json
    ├── lookups.json
    └── changes.json
```

This variant excludes hour-16 data and the scoring script. Use whatever organizers add later without changing schema contracts.

## Manifest columns

`doc_id, jurisdictions, url, source_type, capture, retrieved_at, sha256, text_file, status`

- `capture=yes` + `text_file` → extract from `corpus/text/…`
- `link-only` / empty text → do not fabricate quoted spans

## Address columns

`address_id, street_address, postal_city, state, zip, year_built, units, use_code, use_description, source_dataset, retrieved_at`

### Jurisdiction is not given

`postal_city` is mailing city, not always legal city. Resolve with Census Geocoder (or equivalent). Examples: Van Nuys → City of Los Angeles; Dorchester → Boston.

### Coverage by city

Los Angeles 80 · San Francisco 80 · San Diego 50 · Berkeley 40 · Jersey City 50 · Hoboken 40 · Newark 50 · Boston 60 · Cambridge 50.

### Known gaps (answer `unknown` when they block coverage)

| Gap | Cities / rows |
|-----|----------------|
| No year built | San Diego, Berkeley; many NJ construction years missing |
| No unit count | Berkeley; Jersey City & Newark; 39/40 Hoboken; Boston `use_code` starting `A/` |
| No owner names | All — small-landlord / owner-type exceptions often unresolved |
| No Santa Ana addresses | Santa Ana rules = extraction credit only |
| Year built ≠ COO | SF cutoff 1979-06-13; LA cutoff 1978-10-01 — buildings in cutoff year → `unknown` |

## Schema enums (do not invent synonyms)

**Rule `status`:** `in_force` | `not_yet_effective` | `pending` | `failed`

**Rule `category`:** `rent_increase_limits` | `just_cause_eviction` | `security_deposits` | `application_screening_fees` | `screening_restrictions` | `algorithmic_rent_setting`

**Rule `level`:** `state` | `city`

**Lookup `result`:** `applies` | `unknown` | `superseded` | `not_yet_effective` | `pending`

Leave out rules that don’t apply.

## Change tests in `dev/change_tests.json`

| ID | Type | rule_ids | Key dates / check |
|----|------|----------|-------------------|
| T1 | as_of | `CA-ALG-01` | before 2025-12-31 → `not_yet_effective`; after 2026-01-02 → `applies`; all CA |
| T2 | boundary | `HOB-ALG-01`, `JC-ALG-01` | as_of 2026-10-01; city limits only; not Newark |
| T3 | as_of | `NJ-ALG-01` | 2026-10-01 → `not_yet_effective`; 2027-07-02 → `applies`; conflict with `JC-ALG-01`, `HOB-ALG-01` |
| T4 | pending | `MA-ALG-P1`, `MA-ALG-P2` | pending for Boston/Cambridge; affected = all MA if enacted |
| T5 | negative | `MA-RENT-P1` | no rent cap Boston/Cambridge; status `failed`; affected empty |

T6 (hour 16): fictional Cambridge ordinance — not in this pack yet.

## Open legal questions (bonus to surface)

- Berkeley ch. 13.63: two published effective dates (2026-03-01 ordinance vs Jan 2026 law-firm alert)
- NJ FAIR Act may preempt Jersey City / Hoboken once effective
- LA new RSO formula: 2026-02-02 (LAHD) vs 2026-01-24 (landlord association)
- CA screening-fee cap: no single official 2026 dollar figure

## Public APIs (from guide)

- Census Geocoder — no key; batch ≤ 10,000
- LegiScan / Open States — free keys
- Prefer corpus copies for CA statutes (site blocks scripts)
- No bulk scrape of Municode / eCode360 / American Legal against terms
