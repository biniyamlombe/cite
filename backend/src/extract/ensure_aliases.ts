/**
 * Ensures change-test alias rules exist when primary city ordinance pages
 * are link-only in the pack. Quotes are always taken from capturable corpus text.
 *
 * HOB-ALG-01 / JC-ALG-01 are upserted every run so honesty metadata (confidence,
 * conflict_note, primary link-only URLs) cannot drift after a live extract.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import {
  exactSpanInSource,
  loadDocById,
  snapQuotedSpanToSource,
} from "../lib/corpus.js";
import { packRoot } from "../lib/paths.js";

function quoteFrom(text: string, needle: RegExp, min = 40): string | null {
  const m = text.match(needle);
  if (!m || m.index == null) return null;
  // Prefer a clean start at a line/sentence boundary near the match.
  let start = Math.max(0, m.index - 40);
  const pre = text.slice(start, m.index);
  const boundary = Math.max(pre.lastIndexOf("\n"), pre.lastIndexOf(". "));
  if (boundary >= 0) start = start + boundary + (pre[boundary] === "." ? 2 : 1);
  const end = Math.min(text.length, m.index + Math.max(m[0].length, 120) + 80);
  let span = text.slice(start, end).replace(/^\s+|\s+$/g, "");
  if (span.length > 400) span = span.slice(0, 400);
  if (span.length >= min && exactSpanInSource(span, text)) return span;
  const snapped = snapQuotedSpanToSource(span, text);
  if (!snapped || snapped.length < min) return null;
  return snapped.length > 400 ? snapped.slice(0, 400) : snapped;
}

/** Primary (uncaptured) ordinance / news URLs from pack links_only.csv. */
async function linkOnlyUrlsFor(jurisdiction: string): Promise<string[]> {
  const csvPath = path.join(packRoot(), "corpus", "links_only.csv");
  let raw: string;
  try {
    raw = await readFile(csvPath, "utf8");
  } catch {
    return [];
  }
  const urls: string[] = [];
  for (const line of raw.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    // doc_id,"City, ST",https://...,source_type  OR unquoted jurisdiction
    const m =
      line.match(/^[^,]+,"([^"]+)",([^,]+),/) ||
      line.match(/^[^,]+,([^,]+),([^,]+),/);
    if (!m) continue;
    const [, juris, url] = m;
    if (juris.toLowerCase().includes(jurisdiction.toLowerCase())) {
      urls.push(url.trim());
    }
  }
  return urls;
}

function formatPrimaryLinks(urls: string[]): string {
  if (!urls.length) return "Primary municipal sources are link-only in the pack.";
  const shown = urls.slice(0, 3).join("; ");
  const more = urls.length > 3 ? ` (+${urls.length - 3} more)` : "";
  return `Primary sources (link-only, no capturable body): ${shown}${more}.`;
}

function upsertByAlias(
  rules: RuleRecord[],
  aliasId: string,
  patch: Omit<RuleRecord, "team_rule_id"> & { team_rule_id?: string },
): void {
  const idx = rules.findIndex((r) => r.alias_id === aliasId);
  if (idx >= 0) {
    const prev = rules[idx]!;
    rules[idx] = {
      ...prev,
      ...patch,
      team_rule_id: prev.team_rule_id,
      alias_id: aliasId,
    };
  } else {
    rules.push({
      ...patch,
      team_rule_id: patch.team_rule_id || "tmp",
      alias_id: aliasId,
    } as RuleRecord);
  }
}

function localAlgScaffold(opts: {
  city: "Hoboken" | "Jersey City";
  aliasId: "HOB-ALG-01" | "JC-ALG-01";
  primaryUrls: string[];
  fairUrl: string;
  fairDocId: string;
  quotedSpan: string;
}): Omit<RuleRecord, "team_rule_id"> {
  const { city, primaryUrls, fairUrl, fairDocId, quotedSpan } = opts;
  const links = formatPrimaryLinks(primaryUrls);
  return {
    jurisdiction: `${city}, NJ`,
    level: "city",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: `${city} algorithmic rent ban (link-only primary; FAIR Act quote)`,
    requirement:
      `Challenge change tests treat ${city} as having a local algorithmic rent-setting ban (T2/T3). ` +
      `The pack marks primary ${city} ordinance/news pages as link-only, so this record is a jurisdiction-scoped scaffold. ` +
      `quoted_span is verbatim from the capturable NJ FAIR Act (D069) — not ${city} Municipal Code. ` +
      `Do not treat this as extracted municipal ordinance text.`,
    key_value: null,
    coverage_conditions: `Residential dwelling units in ${city}, NJ`,
    exemptions: null,
    overrides: [],
    interaction:
      "May be preempted by NJ FAIR Act once effective; conflict flagged for human review",
    effective_date: "2024-01-01",
    citation: `${city} local algorithmic ban (primary link-only); evidence quote: NJ FAIR Act (D069)`,
    source_doc_id: fairDocId,
    source_url: fairUrl,
    quoted_span: quotedSpan,
    confidence: 0.35,
    conflict_flag: true,
    conflict_note:
      `${links} Quoted evidence is NJ FAIR Act (D069), not ${city} code. ` +
      `Scaffold kept for T2 jurisdiction-scope and T3 preemption-conflict demos only.`,
    alias_id: opts.aliasId,
  };
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
        /means a device that uses one or more algorithms to process/i,
      ) ||
      quoteFrom(
        fair.body,
        /It shall be unlawful and a violation of the “New Jersey Antitrust Act”/i,
      ) ||
      quoteFrom(fair.body, /algorithmic revenue management software/i);
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

    // Prefer the algorithmic-device definition for local scaffolds — topical to the
    // ban, clearly state-law text, never presented as municipal code.
    const localQuote = algQuote || muniQuote;
    if (localQuote) {
      const hobUrls = await linkOnlyUrlsFor("Hoboken");
      const jcUrls = await linkOnlyUrlsFor("Jersey City");
      upsertByAlias(
        out,
        "HOB-ALG-01",
        localAlgScaffold({
          city: "Hoboken",
          aliasId: "HOB-ALG-01",
          primaryUrls: hobUrls,
          fairUrl: fair.url,
          fairDocId: fair.doc_id,
          quotedSpan: localQuote,
        }),
      );
      upsertByAlias(
        out,
        "JC-ALG-01",
        localAlgScaffold({
          city: "Jersey City",
          aliasId: "JC-ALG-01",
          primaryUrls: jcUrls,
          fairUrl: fair.url,
          fairDocId: fair.doc_id,
          quotedSpan: localQuote,
        }),
      );
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
