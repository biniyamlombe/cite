export const EXTRACTION_SYSTEM = `You are a legal-text extraction agent for a rental housing law navigator.
Extract discrete RULES from the document that fall into exactly these categories:
- rent_increase_limits
- just_cause_eviction
- security_deposits
- application_screening_fees
- screening_restrictions
- algorithmic_rent_setting

Return ONLY valid JSON: {"rules":[...]} with no markdown.

Each rule MUST include:
team_rule_id (temporary, e.g. "tmp-1"), jurisdiction (state code CA/NJ/MA or "City, ST"),
level ("state"|"city"), category (one of the six), status ("in_force"|"not_yet_effective"|"pending"|"failed"),
title, requirement (1-2 plain sentences), citation, source_url, quoted_span (EXACT contiguous text from the document, >=20 chars),
source_doc_id, effective_date (YYYY-MM-DD or YYYY-MM or YYYY or null),
key_value (string or null — never an object), coverage_conditions, exemptions (string or null),
overrides (array), interaction (string or null), confidence (0-1),
conflict_flag (boolean), conflict_note (string or null).
Keep quoted_span short (<= 220 chars) and copied verbatim.

Status is relative to query date 2026-10-01:
- in_force: enacted and effective on/before that date
- not_yet_effective: enacted but effective date after that date
- pending: bill/proposal not enacted
- failed: struck down / withdrawn / never became law

Do NOT invent text. quoted_span must be copied verbatim from the document.
If the document contains no rules in the six categories, return {"rules":[]}.
Do not extract from commentary that is not the legal text itself unless it states a clear failed/pending status.`;

export const RETRY_EXTRACTION_SYSTEM = `You extract housing-law rules as STRICT JSON only.
Return exactly: {"rules":[...]} with no markdown, no commentary.

Constraints to avoid JSON breakage:
- At most 6 rules
- quoted_span must be <= 180 characters, copied verbatim, with " escaped as \\"
- Use only double quotes for JSON keys/strings
- No trailing commas
- conflict_note/exemptions/interaction may be null
- overrides must be []

Categories: rent_increase_limits | just_cause_eviction | security_deposits | application_screening_fees | screening_restrictions | algorithmic_rent_setting
level: state | city
status (as of 2026-10-01): in_force | not_yet_effective | pending | failed
Required per rule: team_rule_id, jurisdiction, level, category, status, title, requirement, citation, source_url, quoted_span, source_doc_id, confidence, conflict_flag
Do not invent quoted_span text.`;

export const QUOTE_RETRY_SYSTEM = `You repair housing-law rule records that failed citation checks.
Return ONLY valid JSON: {"rules":[...]} with no markdown.

For each input rule:
- Keep all fields the same EXCEPT quoted_span (and fix source_doc_id if wrong).
- quoted_span MUST be an EXACT contiguous copy from DOCUMENT TEXT, length >= 20.
- Do not invent or paraphrase. Prefer a short supporting sentence already in the document.
- If you cannot find an exact supporting span, omit that rule from the output array.`;

/** Compact failed rules for quote-retry prompts (drop bulky null/empty fields). */
function slimFailedRules(failedRules: unknown[]): unknown[] {
  return failedRules.map((r) => {
    if (!r || typeof r !== "object") return r;
    const o = r as Record<string, unknown>;
    const keep: Record<string, unknown> = {};
    for (const k of [
      "team_rule_id",
      "jurisdiction",
      "level",
      "category",
      "status",
      "title",
      "requirement",
      "citation",
      "source_url",
      "quoted_span",
      "source_doc_id",
      "effective_date",
      "confidence",
      "conflict_flag",
    ]) {
      if (o[k] !== undefined && o[k] !== null && o[k] !== "") keep[k] = o[k];
    }
    return keep;
  });
}

/** Prefer short windows around each bad span instead of re-sending the whole statute. */
function quoteRetryExcerpts(body: string, failedRules: unknown[], maxChars = 14000): string {
  const windows: string[] = [];
  const half = 1800;
  for (const rule of failedRules) {
    const span =
      typeof rule === "object" &&
      rule &&
      "quoted_span" in rule &&
      typeof (rule as { quoted_span?: unknown }).quoted_span === "string"
        ? (rule as { quoted_span: string }).quoted_span.trim()
        : "";
    if (!span) continue;
    const needle = span.slice(0, 48);
    let idx = body.indexOf(needle);
    if (idx < 0) {
      idx = body.toLowerCase().indexOf(needle.toLowerCase());
    }
    if (idx < 0) {
      // fallback: keyword from title/requirement
      const title =
        typeof rule === "object" &&
        rule &&
        "title" in rule &&
        typeof (rule as { title?: unknown }).title === "string"
          ? (rule as { title: string }).title
          : "";
      const words = title.split(/\s+/).filter((w) => w.length > 5).slice(0, 3);
      for (const w of words) {
        idx = body.toLowerCase().indexOf(w.toLowerCase());
        if (idx >= 0) break;
      }
    }
    if (idx < 0) continue;
    const start = Math.max(0, idx - half);
    const end = Math.min(body.length, idx + half);
    windows.push(body.slice(start, end));
  }
  if (!windows.length) {
    return body.length > maxChars
      ? body.slice(0, maxChars) + "\n\n[TRUNCATED]"
      : body;
  }
  // de-dupe overlapping windows by simple join + truncate
  let joined = windows.join("\n\n---\n\n");
  if (joined.length > maxChars) joined = joined.slice(0, maxChars) + "\n\n[TRUNCATED]";
  return joined;
}

export function buildQuoteRetryUserPrompt(options: {
  doc_id: string;
  body: string;
  failedRules: unknown[];
}): string {
  const slim = slimFailedRules(options.failedRules);
  const body = quoteRetryExcerpts(options.body, options.failedRules);
  return `Document ID: ${options.doc_id}

These rule objects failed because quoted_span was not found verbatim in the document.
Return corrected rules with exact quoted_span values copied from DOCUMENT EXCERPTS.

FAILED RULES JSON:
${JSON.stringify({ rules: slim })}

DOCUMENT EXCERPTS:
${body}`;
}

export function buildUserPrompt(doc: {
  doc_id: string;
  url: string;
  jurisdictions: string[];
  body: string;
}): string {
  // Match chunk size so we do not pay for chars the chunker already dropped.
  const max = 28000;
  const body =
    doc.body.length > max
      ? doc.body.slice(0, max) + "\n\n[TRUNCATED]"
      : doc.body;
  return `Document ID: ${doc.doc_id}
Source URL: ${doc.url}
Manifest jurisdictions: ${doc.jurisdictions.join("; ")}
Query date: 2026-10-01

DOCUMENT TEXT:
${body}`;
}

export function chunkDocBody(body: string, chunkSize = 24000, overlap = 1200): string[] {
  if (body.length <= chunkSize) return [body];
  const chunks: string[] = [];
  let start = 0;
  while (start < body.length) {
    const end = Math.min(body.length, start + chunkSize);
    chunks.push(body.slice(start, end));
    if (end >= body.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
