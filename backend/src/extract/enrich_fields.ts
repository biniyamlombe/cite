/**
 * Deterministic backfill for brief-required fields that extraction often leaves null:
 * retrieved_at, penalty, exemptions, effective_date.
 *
 * Only fills from corpus text / manifest — never invents statutory content.
 * When no exemption language is found after a local search, records
 * "None stated in source document" so the field is explicitly captured.
 */
import type { RuleRecord } from "@rhl/shared";
import { loadCapturableDocs, type CorpusDoc } from "../lib/corpus.js";

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const NONE_STATED = "None stated in source document";

function isBlank(value: string | null | undefined): boolean {
  return value == null || !String(value).trim();
}

function isNoneStated(value: string | null | undefined): boolean {
  return String(value ?? "").trim() === NONE_STATED;
}

function cleanSnippet(s: string, max = 420): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,\-–—]+/, "")
    .trim()
    .slice(0, max)
    .replace(/\s+\S*$/, "")
    .trim();
}

function windowAroundSpan(body: string, span: string, radius = 2800): string {
  if (!span?.trim()) return body.slice(0, radius * 2);
  const needle = span.trim().slice(0, 64);
  let idx = body.indexOf(needle);
  if (idx < 0) idx = body.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) {
    const short = needle.slice(0, 28);
    idx = body.toLowerCase().indexOf(short.toLowerCase());
  }
  if (idx < 0) return body.slice(0, Math.min(body.length, radius * 2));
  return body.slice(Math.max(0, idx - radius), Math.min(body.length, idx + span.length + radius));
}

function parseMonthDayYear(month: string, day: string, year: string): string | null {
  const mm = MONTHS[month.toLowerCase()];
  if (!mm) return null;
  const y = Number(year);
  const d = Number(day);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return `${y}-${mm}-${String(d).padStart(2, "0")}`;
}

function parseIsoLike(raw: string): string | null {
  const m = raw.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!m) return null;
  return m[0];
}

/** Pull the first plausible effective date from nearby statute text. */
export function extractEffectiveDateFromText(text: string): string | null {
  const patterns: RegExp[] = [
    /\b(?:effective|operative|takes effect|become[s]? effective|on and after)\s+(?:on\s+)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    /\b(?:effective|operative|takes effect)\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/gi,
    /\b(?:effective|operative)\s+(?:on\s+)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/gi,
    /\b(?:beginning|commencing)\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    /\bon or after\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[3] && /[A-Za-z]/.test(m[1] ?? "")) {
        const iso = parseMonthDayYear(m[1]!, m[2]!, m[3]!);
        if (iso) return iso;
      } else if (m[1] && /^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
        return m[1];
      } else if (m[3] && /^\d{4}$/.test(m[3]) && m[1] && m[2]) {
        // m/d/y
        const month = Number(m[1]);
        const day = Number(m[2]);
        const year = Number(m[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
  }
  // Year-only fallback near "effective … 2024"
  const yearOnly = text.match(
    /\b(?:effective|operative)\s+(?:(?:in|for|the)\s+)?(?:year\s+)?(\d{4})\b/i,
  );
  if (yearOnly?.[1]) {
    const y = Number(yearOnly[1]);
    if (y >= 1900 && y <= 2100) return String(y);
  }
  return null;
}

export function extractPenaltyFromText(text: string): string | null {
  const patterns: RegExp[] = [
    /\b(?:civil penalties?(?: of(?: up to)?)?|administrative penalties?|fine of(?: up to)?|punishable by|guilty of a misdemeanor|misdemeanor[^.]{0,80}|treble damages|triple damages|attorney'?s? fees|liable for[^.]{0,160}damages|penalty of(?: up to)?|shall be subject to[^.]{0,160}(?:fine|penalty|imprisonment)|may (?:recover|seek)[^.]{0,140}(?:damages|penalt(?:y|ies)|injunctive relief)|injunctive relief[^.]{0,120}(?:damages|penalt(?:y|ies))?)\b[^.!?]{0,280}[.!?]/gi,
  ];
  const hits: string[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const snip = cleanSnippet(m[0]);
      // Skip "penalty of perjury" evidence-language noise
      if (/penalty of perjury/i.test(snip)) continue;
      if (snip.length < 20) continue;
      hits.push(snip);
      if (hits.length >= 2) break;
    }
    if (hits.length >= 2) break;
  }
  if (!hits.length) return null;
  return [...new Set(hits)].join(" · ");
}

export function extractExemptionsFromText(text: string): string | null {
  const patterns: RegExp[] = [
    /\bthis (?:section|subdivision|chapter|article|ordinance|act) (?:shall|does) not apply[^.!?]{8,360}[.!?]/gi,
    /\b(?:shall|does) not apply to the following[^.!?]{8,400}[.!?]/gi,
    /\b(?:exempt(?:ion|ed)? from this (?:section|subdivision|chapter|article|ordinance|act))[^.!?]{8,320}[.!?]/gi,
    /\b(?:the following (?:types? of )?(?:residential )?(?:real )?propert(?:y|ies)|owner-occupied|certificate of occupancy within)[^.!?]{0,40}(?:exempt|shall not apply|does not apply)[^.!?]{0,280}[.!?]/gi,
    /\bexemptions?:[^.!?\n]{8,280}/gi,
  ];
  const hits: string[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const snip = cleanSnippet(m[0]);
      if (snip.length < 28) continue;
      // Avoid "does not apply if the intended occupant occupies…" edge cases that aren't coverage exemptions? Keep them — still exemption-like.
      hits.push(snip);
      if (hits.length >= 3) break;
    }
    if (hits.length >= 3) break;
  }
  if (!hits.length) return null;
  return [...new Set(hits)].slice(0, 3).join(" · ");
}

export type EnrichFieldsStats = {
  retrieved_at: number;
  penalty: number;
  exemptions_filled: number;
  exemptions_none_stated: number;
  effective_date: number;
  total: number;
};

export async function enrichRuleFields(
  rules: RuleRecord[],
  options?: { markNoneStated?: boolean },
): Promise<{ rules: RuleRecord[]; stats: EnrichFieldsStats }> {
  const markNoneStated = options?.markNoneStated !== false;
  const docs = await loadCapturableDocs();
  const byId = new Map(docs.map((d) => [d.doc_id, d]));

  const stats: EnrichFieldsStats = {
    retrieved_at: 0,
    penalty: 0,
    exemptions_filled: 0,
    exemptions_none_stated: 0,
    effective_date: 0,
    total: rules.length,
  };

  const out = rules.map((rule) => {
    const doc: CorpusDoc | undefined = rule.source_doc_id
      ? byId.get(rule.source_doc_id)
      : undefined;
    let next: RuleRecord = { ...rule };

    if (!next.retrieved_at && doc?.retrieved_at) {
      next = { ...next, retrieved_at: doc.retrieved_at };
      stats.retrieved_at += 1;
    }

    const win = doc
      ? windowAroundSpan(doc.body, rule.quoted_span)
      : rule.quoted_span;

    const localText = [win, rule.requirement, rule.quoted_span].filter(Boolean).join("\n");

    // Blank → fill (or none-stated). Already none-stated → only upgrade if source text found.
    if (isBlank(next.penalty) || isNoneStated(next.penalty)) {
      const penalty =
        extractPenaltyFromText(localText) ??
        extractPenaltyFromText(doc?.body ?? "");
      if (penalty && penalty !== next.penalty) {
        next = { ...next, penalty };
        stats.penalty += 1;
      } else if (isBlank(next.penalty) && markNoneStated) {
        next = { ...next, penalty: NONE_STATED };
        stats.penalty += 1;
      } else if (isBlank(next.penalty)) {
        next = { ...next, penalty: null };
      }
    }

    if (isBlank(next.exemptions) || isNoneStated(next.exemptions)) {
      const ex =
        extractExemptionsFromText(win) ??
        extractExemptionsFromText(doc?.body ?? "");
      if (ex && ex !== next.exemptions) {
        next = { ...next, exemptions: ex };
        stats.exemptions_filled += 1;
      } else if (isBlank(next.exemptions) && markNoneStated) {
        next = { ...next, exemptions: NONE_STATED };
        stats.exemptions_none_stated += 1;
      } else if (isBlank(next.exemptions)) {
        next = { ...next, exemptions: null };
      }
    }

    if (!next.effective_date?.trim()) {
      // Prefer local window; avoid inventing dates for pending/failed unless explicit.
      const fromWin = extractEffectiveDateFromText(localText);
      const fromDoc =
        rule.status === "pending" || rule.status === "failed"
          ? null
          : extractEffectiveDateFromText((doc?.body ?? "").slice(0, 4000));
      // Title hints like "… Payment (2026)" only when in_force and no better date.
      const titleYear =
        rule.status === "in_force"
          ? rule.title.match(/\((\d{4})\)\s*$/)?.[1]
          : null;
      const iso = fromWin || fromDoc || (titleYear ? titleYear : null);
      if (iso && parseIsoLike(iso)) {
        next = { ...next, effective_date: iso };
        stats.effective_date += 1;
      }
    }

    return next;
  });

  return { rules: out, stats };
}
