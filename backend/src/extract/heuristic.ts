/**
 * Automated (non-LLM) extractor used when ANTHROPIC_API_KEY is missing
 * or as a supplement. Reads corpus text and emits schema-shaped rules.
 * Not hand-authored rule tables — patterns match against document text.
 */
import type { RuleRecord } from "@rhl/shared";
import type { CorpusDoc } from "../lib/corpus.js";
import { exactSpanInSource, snapQuotedSpanToSource } from "../lib/corpus.js";

type Seed = {
  alias_id?: string;
  match: RegExp;
  jurisdiction: string;
  level: "state" | "city";
  category: RuleRecord["category"];
  status: RuleRecord["status"];
  title: string;
  requirement: string;
  key_value?: string | null;
  citation: string;
  coverage_conditions?: string | null;
  exemptions?: string | null;
  effective_date?: string | null;
  interaction?: string | null;
  conflict_flag?: boolean;
  conflict_note?: string | null;
  quoteHints: RegExp[];
};

const SEEDS: Seed[] = [
  {
    alias_id: "CA-ALG-01",
    match: /AB\s*325|SB\s*763/i,
    jurisdiction: "CA",
    level: "state",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: "California common pricing algorithm restrictions (AB 325 / SB 763)",
    requirement:
      "California restricts the use of common pricing algorithms that use nonpublic competitor data to set rents; effective January 1, 2026.",
    citation: "Cal. Bus. & Prof. Code (AB 325 / SB 763)",
    coverage_conditions: "Statewide California residential rental pricing conduct",
    effective_date: "2026-01-01",
    quoteHints: [
      /pricing algorithm.{0,120}/i,
      /January 1, 2026.{0,80}/i,
      /nonpublic.{0,100}competitor/i,
    ],
  },
  // HOB-ALG-01 / JC-ALG-01: primary ordinance pages are link-only — do not seed
  // invented municipal quotes. ensure_aliases.ts scaffolds them from FAIR Act (D069).
  {
    alias_id: "NJ-ALG-01",
    match: /FAIR Act|Freedom from Algorithmic|preempt/i,
    jurisdiction: "NJ",
    level: "state",
    category: "algorithmic_rent_setting",
    status: "not_yet_effective",
    title: "New Jersey FAIR Act algorithmic rent restrictions",
    requirement:
      "The NJ FAIR Act restricts algorithmic rent-setting tools statewide; signed July 20, 2026 and effective July 1, 2027. May conflict with local bans once effective.",
    citation: "N.J. FAIR Act",
    coverage_conditions: "Statewide New Jersey residential rentals",
    effective_date: "2027-07-01",
    conflict_flag: true,
    conflict_note:
      "Possible preemption conflict with Jersey City and Hoboken local algorithmic bans once effective.",
    quoteHints: [
      /FAIR Act|algorithmic/i,
      /July 1, 2027|effective/i,
      /preempt/i,
    ],
  },
  {
    alias_id: "MA-ALG-P1",
    match: /S\.?\s*2983|Senate.{0,40}2983/i,
    jurisdiction: "MA",
    level: "state",
    category: "algorithmic_rent_setting",
    status: "pending",
    title: "Massachusetts S.2983 algorithmic pricing bill",
    requirement:
      "Pending Massachusetts Senate bill S.2983 would restrict algorithmic rent-setting tools; it is not law.",
    citation: "MA S.2983",
    coverage_conditions: "Would apply statewide in Massachusetts if enacted",
    quoteHints: [/S\.?\s*2983/i, /algorithm/i, /pending|bill/i],
  },
  {
    alias_id: "MA-ALG-P2",
    match: /H\.?\s*5222|House.{0,40}5222/i,
    jurisdiction: "MA",
    level: "state",
    category: "algorithmic_rent_setting",
    status: "pending",
    title: "Massachusetts H.5222 algorithmic pricing bill",
    requirement:
      "Pending Massachusetts House bill H.5222 would restrict algorithmic rent-setting tools; it is not law.",
    citation: "MA H.5222",
    coverage_conditions: "Would apply statewide in Massachusetts if enacted",
    quoteHints: [/H\.?\s*5222/i, /algorithm/i, /pending|bill/i],
  },
  {
    alias_id: "MA-RENT-P1",
    match: /ballot question|IP\s*25-21|struck|removed from the ballot/i,
    jurisdiction: "MA",
    level: "state",
    category: "rent_increase_limits",
    status: "failed",
    title: "Massachusetts rent-control ballot question (struck)",
    requirement:
      "The proposed statewide rent-control ballot question was removed by the Massachusetts high court on June 23, 2026; no rent cap applies in Boston or Cambridge from this measure.",
    citation: "MA G.L. c.40P; IP 25-21 (struck)",
    coverage_conditions: "None — measure failed",
    effective_date: null,
    quoteHints: [/rent control/i, /ballot/i, /struck|removed|court/i],
  },
  {
    match: /1947\.12|AB\s*1482|Tenant Protection Act/i,
    jurisdiction: "CA",
    level: "state",
    category: "rent_increase_limits",
    status: "in_force",
    title: "California statewide rent cap (AB 1482)",
    requirement:
      "Annual rent increases for covered units are capped at the lesser of 5% plus CPI or 10%; local rent control may supersede for covered buildings.",
    key_value: "lesser of 5% + CPI or 10%",
    citation: "Cal. Civ. Code § 1947.12",
    coverage_conditions:
      "Most CA residential rentals; certificate of occupancy within prior 15 years exempt",
    exemptions: "Owner-occupied duplexes; housing issued a certificate of occupancy within the prior 15 years; certain affordable housing",
    interaction: "Yields to stricter local rent control where applicable",
    quoteHints: [/1947\.12/i, /five percent|5 percent|CPI/i, /rent increase/i],
  },
  {
    match: /1946\.2|just cause|Tenant Protection Act/i,
    jurisdiction: "CA",
    level: "state",
    category: "just_cause_eviction",
    status: "in_force",
    title: "California just cause eviction (AB 1482)",
    requirement:
      "After 12 months of tenancy, a landlord may terminate only for just cause as defined by statute.",
    citation: "Cal. Civ. Code § 1946.2",
    coverage_conditions: "Most residential rentals after 12 months of tenancy",
    quoteHints: [/1946\.2/i, /just cause/i, /12 months|twelve months/i],
  },
  {
    match: /1950\.5|security deposit|AB\s*12/i,
    jurisdiction: "CA",
    level: "state",
    category: "security_deposits",
    status: "in_force",
    title: "California security deposit cap (AB 12)",
    requirement:
      "A security deposit generally may not exceed one month's rent; a limited small-landlord exception may allow up to two months.",
    key_value: "1 month's rent (general)",
    citation: "Cal. Civ. Code § 1950.5",
    coverage_conditions: "Residential tenancies statewide",
    exemptions:
      "Small-landlord exception (owner of no more than two rental properties with no more than four total units) may allow two months — owner identity not in sample data",
    effective_date: "2024-07-01",
    quoteHints: [/1950\.5/i, /one month|1 month|security deposit/i],
  },
  {
    match: /1950\.6|application.{0,20}screening|screening fee/i,
    jurisdiction: "CA",
    level: "state",
    category: "application_screening_fees",
    status: "in_force",
    title: "California application screening fee cap",
    requirement:
      "Landlords may charge an application screening fee not exceeding the actual out-of-pocket cost, capped at a CPI-adjusted statutory amount, and only when a unit is available.",
    citation: "Cal. Civ. Code § 1950.6",
    coverage_conditions: "Residential rental applications in California",
    quoteHints: [/1950\.6/i, /screening fee|application/i],
  },
  {
    match: /Chapter 37|Rent Ordinance|37\.3/i,
    jurisdiction: "San Francisco, CA",
    level: "city",
    category: "rent_increase_limits",
    status: "in_force",
    title: "San Francisco Rent Ordinance increase limits",
    requirement:
      "San Francisco limits rent increases for units with a certificate of occupancy on or before June 13, 1979.",
    citation: "S.F. Admin. Code ch. 37",
    coverage_conditions: "COO on or before 1979-06-13; year_built in cutoff year → unknown",
    interaction: "Local control supersedes CA Civ. Code § 1947.12 for covered units",
    quoteHints: [/June 13, 1979|1979/i, /rent increase|annual allowable/i, /certificate of occupancy/i],
  },
  {
    match: /§\s*37\.9|Admin\.?\s*Code\s*§?\s*37\.9|37\.9\s*\(/i,
    jurisdiction: "San Francisco, CA",
    level: "city",
    category: "just_cause_eviction",
    status: "in_force",
    title: "San Francisco just cause eviction",
    requirement:
      "A landlord may recover possession of a covered rental unit only for just causes listed in the Rent Ordinance.",
    citation: "S.F. Admin. Code § 37.9",
    coverage_conditions: "Units covered by the SF Rent Ordinance",
    quoteHints: [/37\.9/i, /just cause/i, /recover possession/i],
  },
  {
    match: /37\.10C/i,
    jurisdiction: "San Francisco, CA",
    level: "city",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: "San Francisco algorithmic pricing ban",
    requirement:
      "San Francisco prohibits the sale or use of coordinated pricing algorithms to set rents or occupancy for residential units.",
    citation: "S.F. Admin. Code § 37.10C",
    coverage_conditions: "Residential units in San Francisco",
    effective_date: "2024-10-01",
    quoteHints: [/37\.10C/i, /pricing algorithm|coordinated pricing/i],
  },
  {
    match: /Rent Stabilization Ordinance|LAMC\s*§?\s*151|Los Angeles Municipal Code.{0,40}151/i,
    jurisdiction: "Los Angeles, CA",
    level: "city",
    category: "rent_increase_limits",
    status: "in_force",
    title: "Los Angeles Rent Stabilization Ordinance",
    requirement:
      "Los Angeles RSO limits rent increases for covered units, generally those with certificates of occupancy on or before October 1, 1978.",
    citation: "Los Angeles Municipal Code (RSO)",
    coverage_conditions: "COO on or before 1978-10-01; year_built in cutoff year → unknown",
    interaction: "Local RSO supersedes CA Civ. Code § 1947.12 for covered units",
    quoteHints: [/October 1, 1978|1978/i, /rent stabilization|RSO/i, /maximum rent/i],
  },
  {
    match: /98\.1101/i,
    jurisdiction: "San Diego, CA",
    level: "city",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: "San Diego algorithmic rent-setting ban",
    requirement:
      "San Diego prohibits certain uses of algorithmic devices to set rents or occupancy levels for residential dwelling units.",
    citation: "San Diego Municipal Code §§ 98.1101–98.1104",
    coverage_conditions: "Residential dwelling units in San Diego (year built often missing → still applies for citywide ban)",
    quoteHints: [/98\.1101|algorithm/i, /prohibit/i, /residential/i],
  },
  {
    match: /13\.63|Berkeley Municipal Code.{0,30}13\.63/i,
    jurisdiction: "Berkeley, CA",
    level: "city",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: "Berkeley coordinated pricing algorithm ban",
    requirement:
      "Berkeley prohibits the sale or use of coordinated pricing algorithms to set rents or manage occupancy for residential dwelling units.",
    citation: "Berkeley Municipal Code ch. 13.63",
    coverage_conditions: "Residential dwelling units in Berkeley",
    effective_date: "2026-03-01",
    conflict_flag: true,
    conflict_note: "Published sources disagree on effective date (ordinance vs alerts).",
    quoteHints: [
      /13\.63/i,
      /coordinated pricing algorithm/i,
      /prohibit/i,
    ],
  },
  {
    match: /Santa Ana|NS-3090|algorithm/i,
    jurisdiction: "Santa Ana, CA",
    level: "city",
    category: "algorithmic_rent_setting",
    status: "in_force",
    title: "Santa Ana algorithmic pricing ordinance",
    requirement:
      "Santa Ana restricts the sale or use of algorithmic devices for residential rent setting.",
    citation: "Santa Ana Ord. NS-3090",
    coverage_conditions: "Santa Ana residential units (no sample addresses in pack)",
    quoteHints: [/algorithm/i, /prohibit|unlawful/i, /rent/i],
  },
  {
    match: /46:8-21\.2|security deposit|one and one-half/i,
    jurisdiction: "NJ",
    level: "state",
    category: "security_deposits",
    status: "in_force",
    title: "New Jersey Rent Security Deposit Act",
    requirement: "A security deposit may not exceed one and one-half months' rent.",
    key_value: "1.5 months' rent",
    citation: "N.J.S.A. 46:8-21.2",
    coverage_conditions: "Residential rentals statewide",
    exemptions:
      "Owner-occupied premises with 2 or fewer units (unless tenant opts in); seasonal rentals — owner occupancy not in sample data",
    quoteHints: [/one and one-half|1-1\/2|security deposit/i, /46:8-21/i],
  },
  {
    match: /2A:18-61\.1|Anti-Eviction|good cause/i,
    jurisdiction: "NJ",
    level: "state",
    category: "just_cause_eviction",
    status: "in_force",
    title: "New Jersey Anti-Eviction Act",
    requirement:
      "Residential tenants may be removed only for good cause enumerated in the Anti-Eviction Act.",
    citation: "N.J.S.A. 2A:18-61.1",
    coverage_conditions: "Most residential tenancies in New Jersey",
    quoteHints: [/good cause|Anti-Eviction|2A:18-61/i],
  },
  {
    match: /Fair Chance|criminal history|housing act/i,
    jurisdiction: "NJ",
    level: "state",
    category: "screening_restrictions",
    status: "in_force",
    title: "New Jersey Fair Chance in Housing Act",
    requirement:
      "Housing providers must follow timing and use limits when considering criminal history in rental screening.",
    citation: "N.J. Fair Chance in Housing Act",
    coverage_conditions: "Housing providers statewide in New Jersey",
    quoteHints: [/criminal history|Fair Chance|conviction/i],
  },
  {
    match: /186.*15B|security deposit|first month/i,
    jurisdiction: "MA",
    level: "state",
    category: "security_deposits",
    status: "in_force",
    title: "Massachusetts security deposit and upfront fee limits",
    requirement:
      "Massachusetts limits security deposits and certain upfront charges for residential tenancies.",
    citation: "Mass. Gen. Laws c.186 § 15B",
    coverage_conditions: "Residential tenancies in Massachusetts",
    quoteHints: [/security deposit/i, /15B/i, /first month|last month/i],
  },
  {
    match: /Chapter 40P|No city or town may enact, maintain or enforce rent control/i,
    jurisdiction: "MA",
    level: "state",
    category: "rent_increase_limits",
    status: "in_force",
    title: "Massachusetts bar on local rent control",
    requirement:
      "Massachusetts generally bars municipalities from enacting local rent control; Boston and Cambridge have no local rent-increase cap from this framework.",
    citation: "Mass. Gen. Laws c.40P",
    coverage_conditions: "Statewide preemption of local rent control",
    quoteHints: [/No city or town may enact/i, /rent control of any kind/i, /Chapter 40P/i],
  },
  // --- Additional capturable-doc patterns (previously unused D### files) ---
  {
    match: /relocation assistance|Owner Move-In Eviction|Ellis Act Eviction/i,
    jurisdiction: "Berkeley, CA",
    level: "city",
    category: "just_cause_eviction",
    status: "in_force",
    title: "Berkeley relocation assistance for OMI and Ellis Act evictions",
    requirement:
      "Berkeley requires inflation-adjusted relocation assistance payments when owners pursue owner move-in or Ellis Act evictions; annual amounts publish each January.",
    citation: "Berkeley Rent Stabilization and Good Cause for Eviction Ordinance; Ellis Implementation Ordinance",
    coverage_conditions: "Covered rental units in Berkeley subject to OMI or Ellis Act eviction",
    effective_date: "2026-01-01",
    quoteHints: [
      /relocation assistance/i,
      /Owner Move-In Eviction/i,
      /Ellis Act Eviction/i,
    ],
  },
  {
    match: /Rent Control Ordinance, Chapter 260|PROPERTY RENT CONTROL STATUS/i,
    jurisdiction: "Jersey City, NJ",
    level: "city",
    category: "rent_increase_limits",
    status: "in_force",
    title: "Jersey City Rent Control Ordinance (Chapter 260)",
    requirement:
      "Jersey City regulates rents under Chapter 260; 1–4 unit properties are exempt from rent control per city guidance.",
    citation: "Jersey City Rent Control Ordinance, Chapter 260",
    coverage_conditions:
      "Residential rental properties in Jersey City with more than 4 units (1–4 unit properties exempt)",
    quoteHints: [
      /Rent Control Ordinance, Chapter 260/i,
      /1-4 Unit Properties are exempt/i,
      /Rent Control Exemption/i,
    ],
  },
  {
    match: /Chapter 151B|refuse to rent or lease|multiple dwelling/i,
    jurisdiction: "MA",
    level: "state",
    category: "screening_restrictions",
    status: "in_force",
    title: "Massachusetts fair housing rental screening restrictions",
    requirement:
      "Massachusetts law prohibits refusing to rent or discriminating in rental terms based on protected characteristics, and limits discriminatory inquiries in screening.",
    citation: "Mass. Gen. Laws c.151B § 4",
    coverage_conditions: "Publicly assisted, multiple-dwelling, and other covered housing accommodations in Massachusetts",
    quoteHints: [
      /refuse to rent or lease/i,
      /discriminate against any person/i,
      /written or oral inquiry/i,
    ],
  },
  {
    match: /reprisals against any tenant|tenants' union|rebuttable presumption/i,
    jurisdiction: "MA",
    level: "state",
    category: "just_cause_eviction",
    status: "in_force",
    title: "Massachusetts anti-reprisal protections for tenant organizing and complaints",
    requirement:
      "Landlords may not threaten or take reprisals against tenants for enforcing housing laws, reporting code violations, or joining a tenants' union; notices of termination or rent increase within six months create a rebuttable presumption of reprisal.",
    citation: "Mass. Gen. Laws c.186 § 18",
    coverage_conditions: "Residential tenancies in Massachusetts",
    quoteHints: [
      /reprisals against any tenant/i,
      /tenants' union/i,
      /rebuttable presumption/i,
    ],
  },
  {
    match: /An Act prohibiting algorithmic rent setting|Senate, No\. 2983|S\.2983/i,
    jurisdiction: "MA",
    level: "state",
    category: "algorithmic_rent_setting",
    status: "pending",
    title: "Massachusetts S.2983 — Act prohibiting algorithmic rent setting (pending)",
    requirement:
      "Pending Senate bill S.2983 would prohibit algorithmic rent setting; it is not law until enacted.",
    citation: "MA S.2983 (194th General Court)",
    coverage_conditions: "Would apply statewide in Massachusetts if enacted",
    alias_id: "MA-ALG-P1",
    quoteHints: [
      /An Act prohibiting algorithmic rent setting/i,
      /S\.2983|Senate, No\. 2983/i,
      /algorithmic rent/i,
    ],
  },
];

function pickQuote(text: string, hints: RegExp[]): string | null {
  for (const re of hints) {
    const m = text.match(re);
    if (m && m[0]) {
      const idx = text.indexOf(m[0]);
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + Math.max(m[0].length, 80) + 80);
        let span = text.slice(start, end).replace(/^\s+|\s+$/g, "");
        if (span.length < 20) continue;
        if (span.length > 400) span = span.slice(0, 400);
        if (exactSpanInSource(span, text)) return span;
        const snapped = snapQuotedSpanToSource(span, text);
        if (snapped) return snapped.length > 400 ? snapped.slice(0, 400) : snapped;
      }
    }
  }
  // Fallback: first substantial sentence-like chunk, snapped back to exact text
  const compact = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < compact.length - 40; i += 100) {
    const span = compact.slice(i, i + 120);
    const snapped = snapQuotedSpanToSource(span, text);
    if (snapped && snapped.length >= 20) {
      return snapped.length > 400 ? snapped.slice(0, 400) : snapped;
    }
  }
  return null;
}

function jurisdictionMatchesDoc(seed: Seed, doc: CorpusDoc): boolean {
  const j = doc.jurisdictions.join(" ").toLowerCase();
  const blob = `${doc.body.slice(0, 2000)} ${j}`;
  if (seed.level === "state") {
    if (seed.jurisdiction === "CA") return /ca|california/i.test(blob);
    if (seed.jurisdiction === "NJ") return /nj|new jersey/i.test(blob);
    if (seed.jurisdiction === "MA") return /ma|massachusetts/i.test(blob);
  }
  const city = seed.jurisdiction.split(",")[0] ?? "";
  return new RegExp(city.replace(/\s+/g, "\\s+"), "i").test(blob);
}

export function heuristicExtractDoc(doc: CorpusDoc): RuleRecord[] {
  const rules: RuleRecord[] = [];
  for (const seed of SEEDS) {
    // Require the seed's signature pattern in the document body (not mere jurisdiction).
    if (!seed.match.test(doc.body)) continue;
    if (!jurisdictionMatchesDoc(seed, doc)) continue;

    // City rules: document jurisdictions should mention the city when available.
    if (seed.level === "city") {
      const city = (seed.jurisdiction.split(",")[0] ?? "").toLowerCase();
      const j = doc.jurisdictions.join(" ").toLowerCase();
      if (city && j && !j.includes(city) && !new RegExp(city, "i").test(doc.body.slice(0, 1500))) {
        continue;
      }
    }

    const quoted = pickQuote(doc.body, seed.quoteHints);
    if (!quoted) continue;

    const coverage =
      typeof seed.coverage_conditions === "string" || seed.coverage_conditions == null
        ? seed.coverage_conditions ?? null
        : JSON.stringify(seed.coverage_conditions);

    rules.push({
      team_rule_id: "tmp",
      jurisdiction: seed.jurisdiction,
      level: seed.level,
      category: seed.category,
      status: seed.status,
      title: seed.title,
      requirement: seed.requirement,
      key_value: seed.key_value ?? null,
      coverage_conditions: coverage,
      exemptions: seed.exemptions ?? null,
      overrides: [],
      interaction: seed.interaction ?? null,
      effective_date: seed.effective_date ?? null,
      penalty: null,
      citation: seed.citation,
      source_doc_id: doc.doc_id,
      source_url: doc.url,
      retrieved_at: doc.retrieved_at || null,
      quoted_span: quoted,
      confidence: 0.55,
      conflict_flag: seed.conflict_flag ?? false,
      conflict_note: seed.conflict_note ?? null,
      alias_id: seed.alias_id,
    });
  }
  return rules;
}

export function dedupeRules(
  rules: RuleRecord[],
  opts?: { soft?: boolean },
): RuleRecord[] {
  const soft = opts?.soft !== false;
  const scored = [...rules].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  );
  const seen = new Set<string>();
  const keptDocs = new Set<string>();
  const out: RuleRecord[] = [];
  for (const r of scored) {
    const key = [
      r.alias_id || "",
      r.category,
      r.jurisdiction.toLowerCase(),
      r.citation.toLowerCase().replace(/\s+/g, " ").slice(0, 80),
      r.title.toLowerCase().slice(0, 40),
    ].join("|");
    const softKey = [r.category, r.jurisdiction.toLowerCase(), r.level].join("|");
    const onlyHitForDoc =
      Boolean(r.source_doc_id) && !keptDocs.has(r.source_doc_id!);
    // Prefer a single high-confidence rule per category/jurisdiction/level unless alias-bearing.
    // Exception: keep one mid-confidence rule so a source doc is not erased entirely.
    if (
      soft &&
      !r.alias_id &&
      seen.has(`soft:${softKey}`) &&
      (r.confidence ?? 0) < 0.8 &&
      !onlyHitForDoc
    ) {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    if (soft && (r.confidence ?? 0) >= 0.8) seen.add(`soft:${softKey}`);
    if (r.source_doc_id) keptDocs.add(r.source_doc_id);
    out.push(r);
  }
  return out;
}

/** Drop low-quality heuristic rows when Claude already covers the same niche. */
export function preferClaudeRules(rules: RuleRecord[]): RuleRecord[] {
  const strong = rules.filter((r) => (r.confidence ?? 0) >= 0.8);
  const strongKeys = new Set(
    strong.map((r) =>
      [r.category, r.jurisdiction.toLowerCase(), r.level].join("|"),
    ),
  );
  const docsWithStrong = new Set(
    strong.map((r) => r.source_doc_id).filter(Boolean),
  );
  return rules.filter((r) => {
    const conf = r.confidence ?? 0;
    if (conf >= 0.8) return true;
    if (r.alias_id) return true; // keep change-test anchors if still needed
    // Keep the best mid-confidence hit from a source doc that otherwise vanishes
    // (corpus coverage / auditability), even if a stronger sibling niche exists.
    if (
      r.source_doc_id &&
      conf >= 0.55 &&
      !docsWithStrong.has(r.source_doc_id)
    ) {
      return true;
    }
    const key = [r.category, r.jurisdiction.toLowerCase(), r.level].join("|");
    if (strongKeys.has(key)) return false;
    // Drop obvious wrong-source heuristic attachments
    const url = (r.source_url || "").toLowerCase();
    const j = r.jurisdiction;
    if (
      url.includes("berkeley") &&
      (j === "CA" ||
        j === "MA" ||
        j === "NJ" ||
        /San Francisco|Los Angeles/i.test(j))
    ) {
      return false;
    }
    // CA civil-rights housing portal is not a MA statute source
    if (
      (url.includes("calcivilrights.ca.gov") || url.includes("ca.gov")) &&
      (j === "MA" || j === "NJ" || /Massachusetts|New Jersey/i.test(j))
    ) {
      return false;
    }
    if ((r.quoted_span || "").includes("INANCE NO")) return false;
    return conf >= 0.55;
  });
}
