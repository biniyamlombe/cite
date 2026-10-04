# Spanish review protocol

## Purpose

Ensure Spanish legal-information copy does not overstate certainty, mis-state legal status, or present machine translation as official law.

## Roles

- **Author:** engineer / product implementing strings or templates  
- **Bilingual reviewer:** Spanish + English housing-law literacy (not necessarily a lawyer)  
- **Legal reviewer (optional escalate):** licensed counsel for contested hedges / status wording  

## What must be reviewed before “human_reviewed”

1. All disclaimers  
2. All legal-status and applicability labels  
3. All error/warning user messages  
4. Glossary terms marked `needs_human_review` or high-risk  
5. Scenario / “if enacted” explanations  
6. Any Spanish source-quote translation (currently disabled — review required if enabled)  
7. Sample of plain-language rule explanations (template coverage + random sample)

## Scorecard

| Score | Meaning |
|-------|---------|
| Pass | Accurate, glossary-aligned, hedges preserved |
| Pass with edits | Publish after applying reviewer edits |
| Needs revision | Do not ship; rewrite required |
| Unsafe / do not publish | Legal-effect or status error |

## Record fields

For each item in `translation_review_queue.json`:

- `content_id`, `source_en`, `candidate_es`, `category`, `risk_level`
- `reviewer`, `reviewed_at`, `score`, `issues[]`, `resolution`, `final_status`

## Back-translation policy

Automated back-translation is **not** proof of correctness. It may only flag discrepancies for human review.

## Cadence

- Before demo claiming bilingual readiness: review all blocker/critical queue items  
- After glossary version bumps: re-review changed terms  
- After template changes: re-review affected explanation classes  
