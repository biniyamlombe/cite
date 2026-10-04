# Legal housing glossary (English → Spanish, `es-US`)

**Version:** 1.0.0  
**Machine-readable source:** [`data/localization/legal_housing_glossary.en-es.json`](../../data/localization/legal_housing_glossary.en-es.json)  
**Policy:** English legal source text remains authoritative. Spanish is renter-facing plain language, not certified translation or legal advice.

## Glossary policy (summary)

1. Prefer neutral U.S. Spanish; avoid country-specific legalese and `vosotros`.
2. One primary term per concept in UI chrome; document regional variants but do not mix arbitrarily.
3. Retain U.S. legal identifiers exactly (bill IDs, section numbers, official titles, URLs).
4. When a U.S. term of art has no safe short equivalent, explain in Spanish and keep the English term in parentheses.
5. Never strengthen hedges (`may` → `must`, `unknown` → `no aplica`).
6. Separate **legal status** labels from **translation status** labels.
7. All high-risk legal labels require human review before claiming production certification.

## Example terminology decisions

| English | Approved Spanish | Notes |
|---------|------------------|-------|
| rental housing | vivienda de alquiler | Primary product term |
| tenant / renter | persona inquilina | Inclusive; `inquilino/a` OK in prose |
| landlord | arrendador/a | `propietario/a` when ownership is the focus |
| unknown | no se puede determinar | Never “no aplica” |
| appears to apply | parece aplicar | Preserve hedge |
| in force | vigente | Distinct from enacted |
| not yet effective | aprobada, pero aún no entra en vigor | Not “pendiente” |
| pending | pendiente | Not current law |
| just-cause eviction | desalojo con justa causa (just-cause eviction) | Keep English on first dense use |
| not legal advice | no es asesoramiento legal | Also “no es asesoría legal” in chrome |

## Full term list

See the JSON file for all fields: part of speech, definition, examples, prohibited translations, and review status.
