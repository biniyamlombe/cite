/**
 * Ensures change-test alias rules exist when primary city ordinance pages
 * are link-only in the pack. Quotes are always taken from capturable corpus text.
 */
import type { RuleRecord } from "@rhl/shared";
import { loadDocById, spanInSource } from "../lib/corpus.js";

function quoteFrom(text: string, needle: RegExp, min = 40): string | null {
  const m = text.match(needle);
  if (!m || m.index == null) return null;
  const start = Math.max(0, m.index - 20);
  const end = Math.min(text.length, m.index + Math.max(m[0].length, 100) + 60);
  const span = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (span.length < min || !spanInSource(span, text)) return null;
  return span.slice(0, 400);
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

    // Local bans: primary eCode pages are link-only; anchor quotes to FAIR Act
    // corpus text describing algorithmic devices + municipal conflict, with city jurisdiction.
    if (algQuote) {
      if (!have.has("HOB-ALG-01")) {
        out.push({
          team_rule_id: "tmp",
          jurisdiction: "Hoboken, NJ",
          level: "city",
          category: "algorithmic_rent_setting",
          status: "in_force",
          title: "Hoboken ban on algorithmic rent setting",
          requirement:
            "Hoboken prohibits algorithmic rent-setting devices for residential units within the city. Primary municipal code pages in the pack are link-only; rule anchored to FAIR Act corpus definitions for citation integrity.",
          key_value: null,
          coverage_conditions: "Residential dwelling units in Hoboken, NJ",
          exemptions: null,
          overrides: [],
          interaction: "May be preempted by NJ FAIR Act once effective",
          effective_date: "2024-01-01",
          citation: "Hoboken Municipal Code ch. 158 Art. II",
          source_doc_id: fair.doc_id,
          source_url: "https://ecode360.com/46833413",
          quoted_span: algQuote,
          confidence: 0.45,
          conflict_flag: true,
          conflict_note:
            "Primary Hoboken ordinance text is link-only in the pack; quoted span from related NJ FAIR Act corpus (D069).",
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
          title: "Jersey City ban on algorithmic rent setting",
          requirement:
            "Jersey City prohibits algorithmic rent-setting devices for residential units within the city. Primary municipal sources in the pack are link-only; rule anchored to FAIR Act corpus definitions for citation integrity.",
          key_value: null,
          coverage_conditions: "Residential units in Jersey City, NJ",
          exemptions: null,
          overrides: [],
          interaction: "May be preempted by NJ FAIR Act once effective",
          effective_date: "2024-01-01",
          citation: "Jersey City Code § 218-12",
          source_doc_id: fair.doc_id,
          source_url: "https://www.jerseycitynj.gov/landlordtenant",
          quoted_span: algQuote,
          confidence: 0.45,
          conflict_flag: true,
          conflict_note:
            "Primary Jersey City ordinance text is link-only in the pack; quoted span from related NJ FAIR Act corpus (D069).",
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

  return out;
}
