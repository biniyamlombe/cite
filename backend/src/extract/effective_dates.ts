/**
 * Effective-date grounding. Every rule's effective_date must be either stated in
 * its source document or derivable from source text (enactment date + an
 * effective-date clause). Model-proposed dates that fail both checks are
 * replaced by the derived date or removed — never kept on trust.
 */
import { DEFAULT_AS_OF, type RuleRecord } from "@rhl/shared";
import { loadCapturableDocs } from "../lib/corpus.js";

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirtieth: 30,
  sixtieth: 60,
  ninetieth: 90,
  "180th": 180,
};

export type EffectiveDateBasisKind =
  | "stated"
  | "derived"
  | "rule_of_law"
  | "not_stated"
  | "removed_unsupported";

export type EffectiveDateGrounding = {
  effective_date: string | null;
  kind: EffectiveDateBasisKind;
  note: string;
};

function flat(text: string): string {
  return text.replace(/\s+/g, " ");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ordinal(word: string): number | null {
  const w = word.toLowerCase();
  if (ORDINALS[w] != null) return ORDINALS[w]!;
  const m = w.match(/^(\d+)(?:st|nd|rd|th)$/);
  return m ? Number(m[1]) : null;
}

function monthIndex(name: string): number | null {
  const i = MONTH_NAMES.indexOf(name.toLowerCase());
  return i >= 0 ? i + 1 : null;
}

/** Enactment / approval date as printed in session laws ("Approved June 18, 2021."). */
export function enactmentDate(body: string): { iso: string; text: string } | null {
  const t = flat(body);
  const m = t.match(
    /\bapproved(?:\s+by\s+governor)?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i,
  );
  if (!m) return null;
  const month = monthIndex(m[1]!);
  if (!month) return null;
  return {
    iso: `${m[3]}-${pad(month)}-${pad(Number(m[2]))}`,
    text: m[0].trim(),
  };
}

function addMonthsFirstDay(iso: string, months: number): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const total = m - 1 + months;
  return `${y + Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Act-level effective date computed only from text in the document. */
export function deriveActEffectiveDate(
  body: string,
  sourceUrl = "",
): EffectiveDateGrounding | null {
  const t = flat(body);
  const enacted = enactmentDate(body);

  const monthClause = t.match(
    /\b(?:act|law) shall take effect on the first day of the ([A-Za-z0-9]+) month (?:next )?following (?:the date of )?enactment/i,
  );
  if (monthClause && enacted) {
    const n = ordinal(monthClause[1]!);
    if (n) {
      return {
        effective_date: addMonthsFirstDay(enacted.iso, n),
        kind: "derived",
        note: `"${monthClause[0]}" + "${enacted.text}"`,
      };
    }
  }

  const dayClause = t.match(
    /\b(?:act|law) shall take effect on the ([A-Za-z0-9]+) day (?:next )?following (?:the date of )?enactment/i,
  );
  if (dayClause && enacted) {
    const n = ordinal(dayClause[1]!);
    if (n) {
      return {
        effective_date: addDays(enacted.iso, n),
        kind: "derived",
        note: `"${dayClause[0]}" + "${enacted.text}"`,
      };
    }
  }

  const immediate = t.match(/\b(?:act|law) shall take effect immediately/i);
  if (immediate && enacted) {
    return {
      effective_date: enacted.iso,
      kind: "derived",
      note: `"${immediate[0]}" + "${enacted.text}"`,
    };
  }

  // California non-urgency statutes take effect January 1 after enactment.
  if (
    /leginfo\.legislature\.ca\.gov/i.test(sourceUrl) &&
    enacted &&
    !/urgency statute/i.test(t)
  ) {
    const year = Number(enacted.iso.slice(0, 4)) + 1;
    return {
      effective_date: `${year}-01-01`,
      kind: "rule_of_law",
      note: `"${enacted.text}" (no urgency clause in source) + Cal. Const. art. IV, § 8(c)(1): non-urgency statutes take effect January 1 of the year after enactment`,
    };
  }

  return null;
}

/** True when the date (at its own precision) is printed in the source text. */
export function dateStatedInSource(iso: string, body: string): boolean {
  const t = flat(body).toLowerCase();
  const parts = iso.split("-");
  const y = parts[0]!;
  if (parts.length === 1) return new RegExp(`\\b${y}\\b`).test(t);
  const m = Number(parts[1]);
  const name = MONTH_NAMES[m - 1]!;
  if (parts.length === 2) {
    return t.includes(`${name} ${y}`) || t.includes(`${name}, ${y}`) || t.includes(iso);
  }
  const d = Number(parts[2]);
  const forms = [
    `${name} ${d}, ${y}`,
    `${name} ${pad(d)}, ${y}`,
    `${name} ${d} ${y}`,
    `${name.slice(0, 3)}. ${d}, ${y}`,
    `${name.slice(0, 3)} ${d}, ${y}`,
    `${m}/${d}/${y}`,
    `${pad(m)}/${pad(d)}/${y}`,
    iso,
  ];
  return forms.some((f) => t.includes(f));
}

/** Year stated near the quoted span, used to downgrade over-precise dates ("fee for 2026"). */
function yearStatedInSpan(iso: string, span: string): boolean {
  const y = iso.slice(0, 4);
  return new RegExp(`\\b${y}\\b`).test(span);
}

export function groundEffectiveDate(
  rule: RuleRecord,
  body: string,
): EffectiveDateGrounding {
  const proposed = rule.effective_date?.trim() || null;
  const derived = deriveActEffectiveDate(body, rule.source_url);

  // Act-level clauses govern statutes. Do not let a model date override them.
  if (derived) {
    if (proposed && proposed !== derived.effective_date && dateStatedInSource(proposed, body)) {
      // A specific stated operative date for this provision beats the act default.
      return { effective_date: proposed, kind: "stated", note: `"${proposed}" stated in source` };
    }
    return derived;
  }

  if (!proposed) {
    return { effective_date: null, kind: "not_stated", note: "No effective date stated in source" };
  }
  if (dateStatedInSource(proposed, body)) {
    return { effective_date: proposed, kind: "stated", note: `"${proposed}" stated in source` };
  }
  if (proposed.length > 4 && yearStatedInSpan(proposed, rule.quoted_span)) {
    const year = proposed.slice(0, 4);
    return {
      effective_date: year,
      kind: "stated",
      note: `Only the year ${year} is stated in the quoted span; month/day removed`,
    };
  }
  return {
    effective_date: null,
    kind: "removed_unsupported",
    note: `Extracted date ${proposed} does not appear in source text and cannot be derived; removed`,
  };
}

/** Ground one rule against its source body; pending/failed measures keep their status and stay undated. */
export function applyEffectiveDateGrounding(
  rule: RuleRecord,
  body: string | undefined,
  asOf = DEFAULT_AS_OF,
): RuleRecord {
  if (!body || rule.status === "pending" || rule.status === "failed") return rule;
  // Scaffolds quote another jurisdiction's text; its effective-date clause is not theirs.
  if (rule.extraction_method === "link_only_scaffold") {
    return { ...rule, effective_date: null, effective_date_basis: "not_stated: primary ordinance is link-only in the pack" };
  }
  const g = groundEffectiveDate(rule, body);
  return {
    ...rule,
    effective_date: g.effective_date,
    effective_date_basis: `${g.kind}: ${g.note}`,
    status: statusForGroundedDate(rule.status, g.effective_date, asOf),
  };
}

export async function groundRuleEffectiveDates(
  rules: RuleRecord[],
  asOf = process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
): Promise<RuleRecord[]> {
  const docs = await loadCapturableDocs();
  const byId = new Map(docs.map((d) => [d.doc_id, d.body]));
  return rules.map((r) =>
    applyEffectiveDateGrounding(r, r.source_doc_id ? byId.get(r.source_doc_id) : undefined, asOf),
  );
}

/** An enacted rule whose grounded date is after the as-of date is not yet effective. */
export function statusForGroundedDate(
  status: RuleRecord["status"],
  effectiveDate: string | null,
  asOf: string,
): RuleRecord["status"] {
  if (status !== "in_force" && status !== "not_yet_effective") return status;
  if (!effectiveDate || effectiveDate.length !== 10) return status;
  return effectiveDate > asOf ? "not_yet_effective" : "in_force";
}
