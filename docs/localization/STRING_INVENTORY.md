# String inventory

Total UI keys: **637** (en/es parity).

See `STRING_INVENTORY.csv` for the full table.

## By type

- UI chrome / navigation: 444
- Plain-language generated explanation: 54
- Tooltip / help text: 21
- Form label or helper text: 18
- Warning message: 18
- Button or action: 17
- Loading/progress message: 16
- Error message: 14
- Applicability status label: 8
- Rule category: 6
- Legal status label: 6
- Disclaimer: 5
- Legal source quotation: 5
- Export/report label: 3
- Accessibility-only text: 2

## Non-catalog content (not in i18n table)

| Content | Type | Spanish behavior |
|---------|------|------------------|
| `rule.quoted_span` | Legal source quotation | Remains English; labeled authoritative |
| `rule.citation` / bill IDs | Citation / identifier | Do not translate |
| `explanation` (API) | Plain-language / data-derived | Template ES when safe; else EN + notice |
| Rule titles / requirements | Data-derived legal content | Remain English (corpus) |
| User notes / memos | User-provided content | Not auto-translated |
