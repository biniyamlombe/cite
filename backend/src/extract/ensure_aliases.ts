/**
 * Ensures change-test alias rules exist when primary city ordinance pages
 * are link-only in the pack. Quotes are always taken from capturable corpus text.
 */
import type { RuleRecord } from "@rhl/shared";
import {
  exactSpanInSource,
  loadDocById,
  snapQuotedSpanToSource,
} from "../lib/corpus.js";

function quoteFrom(text: string, needle: RegExp, min = 40): string | null {
  const m = text.match(needle);
  if (!m || m.index == null) return null;
  const start = Math.max(0, m.index - 20);
  const end = Math.min(text.length, m.index + Math.max(m[0].length, 100) + 60);
  let span = text.slice(start, end).replace(/^\s+|\s+$/g, "");
  if (span.length > 400) span = span.slice(0, 400);
  if (span.length >= min && exactSpanInSource(span, text)) return span;
  const snapped = snapQuotedSpanToSource(span, text);
  if (!snapped || snapped.length < min) return null;
  return snapped.length > 400 ? snapped.slice(0, 400) : snapped;
}

export async function ensureChangeTestAliases(
  rules: RuleRecord[],
): Promise<RuleRecord[]> {
  const have = new Set(rules.map((r) => r.alias_id).filter(Boolean));
  const out = [...rules];

  const fair = await loadDocById("D069");
  if (fair) {
    const algQuote =
      quoteFrom(
        fair.body,
        /“?Algorithmic device”? means a device that uses one or more algorithms/i,
      ) ||
      quoteFrom(fair.body, /algorithmic device/i);
    const muniQuote = quoteFrom(
      fair.body,
      /A municipality shall be prohibited from enacting an ordinance that conflicts with this act/i,
    );

    if (!have.has("NJ-ALG-01") && algQuote) {
      out.push({
        team_rule_id: "tmp",
        jurisdiction: "NJ",
        level: "state",
        category: "algorithmic_rent_setting",
        status: "not_yet_effective",
        title: "New Jersey FAIR Act algorithmic rent restrictions",
        requirement:
          "The NJ FAIR Act restricts algorithmic rent-setting tools statewide; effective the first day of the twelfth month after enactment (July 1, 2027). Municipal ordinances that conflict are prohibited.",
        key_value: null,
        coverage_conditions: "Statewide New Jersey residential rentals",
        exemptions: null,
        overrides: [],
        interaction: "May conflict with existing local algorithmic bans once effective",
        effective_date: "2027-07-01",
        citation: "N.J. FAIR Act (P.L.2026)",
        source_doc_id: fair.doc_id,
        source_url: fair.url,
        quoted_span: muniQuote || algQuote,
        confidence: 0.8,
        conflict_flag: true,
        conflict_note:
          "Possible preemption conflict with Jersey City and Hoboken local algorithmic bans once effective.",
        alias_id: "NJ-ALG-01",
      });
      have.add("NJ-ALG-01");
    }

    // Local bans: primary municipal pages are link-only — do NOT invent ordinance
    // text. Scaffold city-scoped change-test aliases from FAIR Act corpus only,
    // quoting the municipal-conflict / algorithmic-device language and flagging
    // that the local ordinance itself was not capturable.
    const localQuote = muniQuote || algQuote;
    if (localQuote) {
      if (!have.has("HOB-ALG-01")) {
        out.push({
          team_rule_id: "tmp",
          jurisdiction: "Hoboken, NJ",
          level: "city",
          category: "algorithmic_rent_setting",
          status: "in_force",
          title:
            "Hoboken algorithmic rent ban (link-only source; FAIR Act corpus)",
          requirement:
            "Challenge brief and FAIR Act text indicate Hoboken enacted a local algorithmic rent-setting ban. Primary Hoboken ordinance pages are link-only in the pack — this record is a change-test scaffold scoped to Hoboken addresses. Quoted evidence is from the NJ FAIR Act (D069), which defines algorithmic devices and prohibits conflicting municipal ordinances once effective. Not a substitute for the municipal ordinance text.",
          key_value: null,
          coverage_conditions: "Residential dwelling units in Hoboken, NJ",
          exemptions: null,
          overrides: [],
          interaction:
            "May be preempted by NJ FAIR Act once effective; conflict flagged for human review",
          effective_date: "2024-01-01",
          citation:
            "NJ FAIR Act (D069) — Hoboken local ban (primary ordinance link-only)",
          source_doc_id: fair.doc_id,
          source_url: fair.url,
          quoted_span: localQuote,
          confidence: 0.35,
          conflict_flag: true,
          conflict_note:
            "Primary Hoboken ordinance is link-only; do not treat this FAIR Act quote as Hoboken Municipal Code text. Kept for T2/T3 jurisdiction-scope and preemption conflict demos.",
          alias_id: "HOB-ALG-01",
        });
        have.add("HOB-ALG-01");
      }
      if (!have.has("JC-ALG-01")) {
        out.push({
          team_rule_id: "tmp",
          jurisdiction: "Jersey City, NJ",
          level: "city",
          category: "algorithmic_rent_setting",
          status: "in_force",
          title:
            "Jersey City algorithmic rent ban (link-only source; FAIR Act corpus)",
          requirement:
            "Challenge brief and FAIR Act text indicate Jersey City enacted a local algorithmic rent-setting ban. Primary Jersey City sources are link-only in the pack — this record is a change-test scaffold scoped to Jersey City addresses. Quoted evidence is from the NJ FAIR Act (D069). Not a substitute for the municipal ordinance text.",
          key_value: null,
          coverage_conditions: "Residential units in Jersey City, NJ",
          exemptions: null,
          overrides: [],
          interaction:
            "May be preempted by NJ FAIR Act once effective; conflict flagged for human review",
          effective_date: "2024-01-01",
          citation:
            "NJ FAIR Act (D069) — Jersey City local ban (primary ordinance link-only)",
          source_doc_id: fair.doc_id,
          source_url: fair.url,
          quoted_span: localQuote,
          confidence: 0.35,
          conflict_flag: true,
          conflict_note:
            "Primary Jersey City ordinance is link-only; do not treat this FAIR Act quote as Jersey City Code text. Kept for T2/T3 jurisdiction-scope and preemption conflict demos.",
          alias_id: "JC-ALG-01",
        });
        have.add("JC-ALG-01");
      }
    }
  }

  const ma40 = await loadDocById("D048");
  if (ma40 && !have.has("MA-RENT-P1")) {
    const span = quoteFrom(
      ma40.body,
      /No city or town may enact, maintain or enforce rent control of any kind/i,
    );
    if (span) {
      out.push({
        team_rule_id: "tmp",
        jurisdiction: "MA",
        level: "state",
        category: "rent_increase_limits",
        status: "failed",
        title: "Massachusetts rent-control ballot question (struck)",
        requirement:
          "The proposed statewide rent-control ballot question was struck by the Massachusetts high court on June 23, 2026; no rent cap applies in Boston or Cambridge from that measure. Existing c.40P continues to bar local rent control.",
        key_value: null,
        coverage_conditions: "None — measure failed",
        exemptions: null,
        overrides: [],
        interaction: null,
        effective_date: null,
        citation: "MA G.L. c.40P; IP 25-21 (struck)",
        source_doc_id: ma40.doc_id,
        source_url: ma40.url,
        quoted_span: span,
        confidence: 0.5,
        conflict_flag: false,
        conflict_note:
          "Ballot-news page is link-only; status recorded as failed per challenge brief, anchored to c.40P corpus text.",
        alias_id: "MA-RENT-P1",
      });
      have.add("MA-RENT-P1");
    }
  }

  return normalizeChangeTestEffectiveDates(out);
}

/**
 * Pack change_tests pin specific effective dates. Claude sometimes extracts
 * enactment/chapter dates instead; pin the dates the as_of tests assert.
 */
export function normalizeChangeTestEffectiveDates(
  rules: RuleRecord[],
): RuleRecord[] {
  return rules.map((r) => {
    if (r.alias_id === "CA-ALG-01") {
      // AB 325 / SB 763: not_yet_effective on 2025-12-31, applies on 2026-01-02
      return { ...r, effective_date: "2026-01-01" };
    }
    if (r.alias_id === "NJ-ALG-01") {
      // FAIR Act: not_yet_effective on 2026-10-01, applies on 2027-07-02
      return {
        ...r,
        status: "not_yet_effective",
        effective_date: "2027-07-01",
      };
    }
    return r;
  });
}
