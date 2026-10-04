/**
 * Ensures change-test alias rules exist when primary city ordinance pages
 * are link-only in the pack. Also upserts soft-gap screening rules from thin
 * capturable pages (D029 / D078) that extract often skips.
 *
 * Quotes are always taken from capturable text — pack corpus or stretch
 * secondary public reports (never invented municipal code).
 *
 * HOB-ALG-01 / JC-ALG-01 prefer city-scoped secondary news quotes when present;
 * FAIR Act (D069) remains a last-resort evidence quote only.
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
import { groundRuleEffectiveDates } from "./effective_dates.js";

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

function nextTeamRuleId(rules: RuleRecord[]): string {
  let max = 0;
  for (const r of rules) {
    const m = /^r-(\d+)$/.exec(r.team_rule_id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `r-${String(max + 1).padStart(4, "0")}`;
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
      team_rule_id: patch.team_rule_id || nextTeamRuleId(rules),
      alias_id: aliasId,
    } as RuleRecord);
  }
}

type CityEvidenceKind = "municipal_ordinance" | "secondary_report" | "fair_fallback";

function localAlgRecord(opts: {
  city: "Hoboken" | "Jersey City";
  aliasId: "HOB-ALG-01" | "JC-ALG-01";
  primaryUrls: string[];
  evidenceUrl: string;
  evidenceDocId: string;
  quotedSpan: string;
  evidenceKind: CityEvidenceKind;
  citation: string;
  title: string;
  requirement: string;
}): Omit<RuleRecord, "team_rule_id"> {
  const { city, primaryUrls, evidenceUrl, evidenceDocId, quotedSpan, evidenceKind } = opts;
  const links = formatPrimaryLinks(primaryUrls);
  const municipal = evidenceKind === "municipal_ordinance";
  const secondary = evidenceKind === "secondary_report";
  return {
    jurisdiction: `${city}, NJ`,
    level: "city",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: opts.title,
    requirement: opts.requirement,
    key_value: null,
    coverage_conditions: `Residential dwelling units in ${city}, NJ`,
    exemptions: null,
    overrides: [],
    interaction:
      "May be preempted by NJ FAIR Act once effective; conflict flagged for human review",
    effective_date: null,
    citation: opts.citation,
    source_doc_id: evidenceDocId,
    source_url: evidenceUrl,
    quoted_span: quotedSpan,
    confidence: municipal ? 0.9 : secondary ? 0.55 : 0.35,
    conflict_flag: true,
    requires_human_review: !municipal,
    extraction_method: municipal
      ? "municipal_ordinance"
      : secondary
        ? "secondary_report"
        : "link_only_scaffold",
    status_basis: municipal
      ? null
      : `unverified: status follows the pack change test (T2), not captured ${city} ordinance text. Effective date unknown.`,
    conflict_note: municipal
      ? `${links} Quoted evidence is the adopted ${city} ordinance PDF (${evidenceDocId}). ` +
        `Pack ecode360/news pages remain link-only; possible FAIR Act preemption once statewide law is effective.`
      : secondary
        ? `${links} Quoted evidence is a secondary public report (${evidenceDocId}), not ${city} Municipal Code. ` +
          `Kept for T2 jurisdiction-scope and T3 conflict demos; human review of the primary ordinance is required.`
        : `${links} Quoted evidence is NJ FAIR Act (D069), not ${city} code. ` +
          `Scaffold kept for T2 jurisdiction-scope and T3 preemption-conflict demos only.`,
    alias_id: opts.aliasId,
  };
}

async function cityAlgEvidence(
  city: "Hoboken" | "Jersey City",
): Promise<{
  docId: string;
  url: string;
  quote: string;
  kind: CityEvidenceKind;
  citation: string;
  title: string;
  requirement: string;
} | null> {
  // Prefer official adopted ordinance PDFs captured under stretch secondary_corpus.
  const ordId = city === "Hoboken" ? "HOB-ORD-01" : "JC-ORD-01";
  const ord = await loadDocById(ordId);
  if (ord?.body) {
    const needles =
      city === "Hoboken"
        ? [
            /Landlords who rent any residential dwelling unit[\s\S]{0,220}?algorithmic pricing/i,
            /prohibited from price fixing using algorithmic pricing/i,
            /PROHIBITION AGAINST ALGORITHMIC RENT-FIXING/i,
          ]
        : [
            /It is unlawful for any real estate lessor[\s\S]{0,220}?Service Provider/i,
            /§\s*218-12 Preventing Algorithmic Rent Fixing/i,
            /unlawful for any real estate lessor, agent, or subcontractor/i,
          ];
    for (const needle of needles) {
      const quote = quoteFrom(ord.body, needle, 60);
      if (!quote) continue;
      return {
        docId: ordId,
        url: ord.url,
        quote,
        kind: "municipal_ordinance",
        citation:
          city === "Hoboken"
            ? "Hoboken City Code §154-8 / Ch. 158 algorithmic rent-fixing ordinance (Council PDF)"
            : "Jersey City Code §218-12 (Ord. 25-057) Preventing Algorithmic Rent-Fixing",
        title:
          city === "Hoboken"
            ? "Hoboken prohibition against algorithmic rent-fixing"
            : "Jersey City preventing algorithmic rent-fixing in the rental housing market",
        requirement:
          city === "Hoboken"
            ? "Landlords renting residential dwelling units in Hoboken are prohibited from price fixing using algorithmic pricing (software, algorithms, or data-sharing platforms that collect and analyze nonpublic competitor data)."
            : "It is unlawful for Jersey City real estate lessors to subscribe to or contract for service-provider algorithmic coordinating services; service providers may not facilitate non-compete agreements among lessors.",
      };
    }
  }

  const newsId = city === "Hoboken" ? "HOB-NEWS-01" : "JC-NEWS-01";
  const news = await loadDocById(newsId);
  if (news?.body) {
    const needles =
      city === "Hoboken"
        ? [
            /City of Hoboken has outlawed the use of algorithmic rent-setting software/i,
            /no longer use software, algorithms, or data-sharing platforms to coordinate/i,
          ]
        : [
            /Jersey City Council unanimously approved \(9-0\) a measure banning rent-setting algorithms/i,
            /measure banning rent-setting algorithms such as RealPage/i,
          ];
    for (const needle of needles) {
      const quote = quoteFrom(news.body, needle, 60);
      if (!quote) continue;
      return {
        docId: newsId,
        url: news.url,
        quote,
        kind: "secondary_report",
        citation: `${city} local algorithmic ban; evidence: ${newsId} secondary report`,
        title: `${city} algorithmic rent ban (secondary report; primary ordinance link-only)`,
        requirement:
          `Public ${city} reporting describes a local ban on algorithmic rent-setting. ` +
          `Pack primary ordinance pages remain link-only; quoted_span is verbatim from ${newsId}.`,
      };
    }
  }
  return null;
}

const NJ_FAIR_SYNTHETIC_TITLE = "New Jersey FAIR Act algorithmic rent restrictions";

const NJ_FAIR_CONFLICT_NOTE =
  "Possible preemption conflict with Jersey City and Hoboken local algorithmic bans once effective " +
  "(FAIR Act §6b: a municipality shall be prohibited from enacting an ordinance that conflicts with this act). " +
  "Human review required; Cite does not decide which rule prevails.";

/**
 * Prefer an extracted operative FAIR Act provision over the synthetic anchor:
 * move NJ-ALG-01 onto it and drop the synthetic duplicate.
 */
function promoteExtractedNjFair(rules: RuleRecord[]): RuleRecord[] {
  const isSynthetic = (r: RuleRecord) =>
    r.title === NJ_FAIR_SYNTHETIC_TITLE || r.extraction_method === "corpus_anchor";
  const candidate = rules
    .filter(
      (r) =>
        r.source_doc_id === "D069" &&
        r.level === "state" &&
        r.category === "algorithmic_rent_setting" &&
        !isSynthetic(r) &&
        (!r.alias_id || r.alias_id === "NJ-ALG-01"),
    )
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (!candidate) return rules;
  return rules
    .filter((r) => r === candidate || !(r.alias_id === "NJ-ALG-01" || (isSynthetic(r) && r.source_doc_id === "D069")))
    .map((r) =>
      r === candidate
        ? {
            ...r,
            alias_id: "NJ-ALG-01",
            conflict_flag: true,
            conflict_note: NJ_FAIR_CONFLICT_NOTE,
            interaction: "May conflict with existing local algorithmic bans once effective",
          }
        : r,
    );
}

export async function ensureChangeTestAliases(
  rules: RuleRecord[],
): Promise<RuleRecord[]> {
  const out = promoteExtractedNjFair([...rules]);
  const have = new Set(out.map((r) => r.alias_id).filter(Boolean));

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
        team_rule_id: nextTeamRuleId(out),
        jurisdiction: "NJ",
        level: "state",
        category: "algorithmic_rent_setting",
        status: "not_yet_effective",
        title: NJ_FAIR_SYNTHETIC_TITLE,
        requirement:
          "The NJ FAIR Act restricts algorithmic rent-setting tools statewide. Municipal ordinances that conflict with the act are prohibited.",
        key_value: null,
        coverage_conditions: "Statewide New Jersey residential rentals",
        exemptions: null,
        overrides: [],
        interaction: "May conflict with existing local algorithmic bans once effective",
        effective_date: null,
        citation: "N.J. FAIR Act (P.L.2026, c.43)",
        source_doc_id: fair.doc_id,
        source_url: fair.url,
        quoted_span: muniQuote || algQuote,
        confidence: 0.8,
        conflict_flag: true,
        conflict_note: NJ_FAIR_CONFLICT_NOTE,
        extraction_method: "corpus_anchor",
        alias_id: "NJ-ALG-01",
      });
      have.add("NJ-ALG-01");
    }

    // Prefer adopted municipal ordinance PDFs; then secondary news; FAIR quote last.
    const localQuote = algQuote || muniQuote;
    const hobUrls = await linkOnlyUrlsFor("Hoboken");
    const jcUrls = await linkOnlyUrlsFor("Jersey City");
    for (const city of ["Hoboken", "Jersey City"] as const) {
      const aliasId = city === "Hoboken" ? "HOB-ALG-01" : "JC-ALG-01";
      const evidence = await cityAlgEvidence(city);
      const urls = city === "Hoboken" ? hobUrls : jcUrls;
      if (evidence) {
        upsertByAlias(
          out,
          aliasId,
          localAlgRecord({
            city,
            aliasId,
            primaryUrls: urls,
            evidenceUrl: evidence.url,
            evidenceDocId: evidence.docId,
            quotedSpan: evidence.quote,
            evidenceKind: evidence.kind,
            citation: evidence.citation,
            title: evidence.title,
            requirement: evidence.requirement,
          }),
        );
      } else if (localQuote) {
        upsertByAlias(
          out,
          aliasId,
          localAlgRecord({
            city,
            aliasId,
            primaryUrls: urls,
            evidenceUrl: fair.url,
            evidenceDocId: fair.doc_id,
            quotedSpan: localQuote,
            evidenceKind: "fair_fallback",
            citation: `${city} local algorithmic ban (primary link-only); evidence quote: NJ FAIR Act (D069)`,
            title: `${city} algorithmic rent ban (link-only primary; FAIR Act quote)`,
            requirement:
              `Challenge change tests treat ${city} as having a local algorithmic rent-setting ban (T2/T3). ` +
              `quoted_span is verbatim from the capturable NJ FAIR Act (D069) — not ${city} Municipal Code.`,
          }),
        );
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
        team_rule_id: nextTeamRuleId(out),
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

  // Soft gaps: capturable pages extract often skips (portal chrome + FAQ text).
  const cam = await loadDocById("D029");
  if (cam) {
    const fhQuote =
      quoteFrom(
        cam.body,
        /The Fair Housing Ordinance prohibits discrimination in real estate transactions such as:/i,
      ) ||
      quoteFrom(
        cam.body,
        /Source of Income, includes Section 8 and public benefits/i,
        30,
      );
    if (fhQuote) {
      upsertByAlias(out, "CAM-FH-01", {
        jurisdiction: "Cambridge, MA",
        level: "city",
        category: "screening_restrictions",
        status: "in_force",
        title:
          "Cambridge Fair Housing Ordinance — source of income and rental discrimination",
        requirement:
          "Cambridge's Fair Housing Ordinance prohibits discrimination in rental transactions " +
          "(including viewing or renting an apartment) based on protected categories that include " +
          "source of income (Section 8 and public benefits).",
        key_value: null,
        coverage_conditions:
          "Housing / real estate transactions in Cambridge, MA (owner-occupied 2-family exemption noted in source FAQ)",
        exemptions: "Exemption noted for 2-family dwellings when the owner lives there",
        overrides: [],
        interaction: null,
        effective_date: null,
        citation: "Cambridge Fair Housing Ordinance (HRC FAQ summary; D029)",
        source_doc_id: cam.doc_id,
        source_url: cam.url,
        quoted_span: fhQuote,
        confidence: 0.65,
        conflict_flag: false,
        conflict_note:
          "Quoted from capturable Cambridge HRC page (D029). Pack text is FAQ/summary of the ordinance, not the full municipal code body.",
        alias_id: "CAM-FH-01",
        extraction_method: "soft_gap_scaffold",
        requires_human_review: true,
        status_basis:
          "unverified: soft-gap FAQ/summary extract (D029); not a full municipal code body.",
      });
    }
  }

  const sfHrc = await loadDocById("D078");
  if (sfHrc) {
    const fcQuote = quoteFrom(
      sfHrc.body,
      /San Francisco's Fair Chance Ordinance protects residents with arrest or conviction history in affordable housing decisions\./i,
      40,
    );
    if (fcQuote) {
      upsertByAlias(out, "SF-FC-01", {
        jurisdiction: "San Francisco, CA",
        level: "city",
        category: "screening_restrictions",
        status: "in_force",
        title:
          "San Francisco Fair Chance Ordinance — affordable housing criminal history",
        requirement:
          "San Francisco's Fair Chance Ordinance protects residents with arrest or conviction history " +
          "in affordable housing decisions. Pack capture is a one-sentence HRC summary, not the full ordinance.",
        key_value: null,
        coverage_conditions:
          "Affordable housing decisions in San Francisco, CA (scope beyond this sentence is unknown from pack text)",
        exemptions: null,
        overrides: [],
        interaction: null,
        effective_date: null,
        citation: "San Francisco Fair Chance Ordinance (HRC summary; D078)",
        source_doc_id: sfHrc.doc_id,
        source_url: sfHrc.url,
        quoted_span: fcQuote,
        confidence: 0.4,
        conflict_flag: true,
        conflict_note:
          "D078 pack page is mostly agency chrome; quoted_span is the only Fair Chance sentence captured. " +
          "Do not treat as a full ordinance extract — human review of the primary ordinance is recommended.",
        alias_id: "SF-FC-01",
        extraction_method: "soft_gap_scaffold",
        requires_human_review: true,
        status_basis:
          "unverified: soft-gap FAQ/summary extract (D078); not a full municipal code body.",
      });
    }
  }

  return groundRuleEffectiveDates(mergeSameBillDuplicates(out));
}

/** "S.2983, 194th General Court" and "S.2983 (194th Legislature)" name the same bill. */
function billKey(r: RuleRecord): string | null {
  const m = /\b([SH])\.?\s?(\d{2,5})\b/.exec(r.citation);
  return m ? `${r.jurisdiction}|${r.category}|${m[1]}.${m[2]}` : null;
}

/**
 * A pending bill captured from several pack pages (bill text, bill history) is one
 * rule: keep the change-test alias record and drop un-aliased copies of the same bill.
 */
export function mergeSameBillDuplicates(rules: RuleRecord[]): RuleRecord[] {
  const aliased = new Map<string, RuleRecord>();
  for (const r of rules) {
    const k = r.status === "pending" && r.alias_id ? billKey(r) : null;
    if (k) aliased.set(k, r);
  }
  return rules.filter((r) => {
    if (r.alias_id || r.status !== "pending") return true;
    const k = billKey(r);
    return !k || !aliased.has(k);
  });
}
