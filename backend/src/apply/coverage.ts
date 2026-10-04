import {
  coveragePlainText,
  AsOfDateSchema,
  DEFAULT_AS_OF,
  toCanonicalApplicability,
  type LookupEntry,
  type RuleRecord,
} from "@rhl/shared";
import {
  parseOptionalInt,
  type SampleAddress,
} from "../lib/addresses.js";
import {
  isTrustedLegalCity,
  type GeocodeResult,
} from "../geocode/census.js";
import {
  evaluateExecutableCoverage,
  executableFromRule,
} from "./executable.js";
import { withOpenQuestionNote } from "./open_questions.js";
import { compileCoverageConditions } from "./compile_coverage.js";

function buildingFacts(addr: SampleAddress, geo: GeocodeResult): {
  used: string[];
  missing: string[];
} {
  const used: string[] = [`state=${geo.state}`, `legal_city=${geo.legal_city}`];
  const missing: string[] = [];
  if (geo.county) used.push(`county=${geo.county}`);
  const year = parseOptionalInt(addr.year_built);
  const units = parseOptionalInt(addr.units);
  if (year != null) used.push(`year_built=${year}`);
  else missing.push("year_built");
  if (units != null) used.push(`units=${units}`);
  else missing.push("units");
  missing.push("owner_type"); // never in pack sample
  return { used, missing };
}

function enrichEntry(
  entry: LookupEntry,
  rule: RuleRecord,
  addr: SampleAddress,
  geo: GeocodeResult,
  asOf: string,
): LookupEntry {
  const facts = buildingFacts(addr, geo);
  const scaffold =
    rule.extraction_method === "link_only_scaffold" ||
    rule.extraction_method === "secondary_report";
  const conflict = Boolean(entry.conflict_flag);
  // Human review: legal conflicts and rules that still require a human — not every missing fact.
  const needsReview = conflict || rule.requires_human_review === true;
  const covText = coveragePlainText(rule.coverage_conditions);
  const coverage_conditions_evaluated = [
    `jurisdiction_match=${rule.jurisdiction}`,
    `level=${rule.level}`,
    ...(covText ? [`coverage=${covText.slice(0, 160)}`] : []),
  ];
  const exemptions_evaluated = rule.exemptions
    ? [`exemptions=${rule.exemptions.slice(0, 160)}`]
    : [];
  return {
    ...entry,
    conflict_flag: conflict,
    needs_human_review: needsReview,
    applicability: toCanonicalApplicability(entry.result, needsReview),
    facts_used: facts.used,
    // Surface missing facts when coverage is unresolved; always note owner_type is unavailable.
    facts_missing:
      entry.result === "unknown"
        ? facts.missing
        : facts.missing.includes("owner_type")
          ? ["owner_type"]
          : [],
    // Scaffolds have no captured law text, so no legal status is asserted for them.
    ...(scaffold ? {} : { legal_status_at_as_of_date: statusAsOf(rule, asOf) }),
    coverage_conditions_evaluated,
    exemptions_evaluated,
  };
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return new Date(`${s}-01-01T00:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  return null;
}

/** Legal status on the query date: an enacted rule flips to in_force once its effective date passes. */
export function statusAsOf(rule: RuleRecord, asOf: string): RuleRecord["status"] {
  if (rule.status !== "in_force" && rule.status !== "not_yet_effective") return rule.status;
  const cmp = compareAsOf(asOf, rule.effective_date);
  if (cmp === "before") return "not_yet_effective";
  if (cmp === "on_or_after") return "in_force";
  return rule.status;
}

function compareAsOf(
  asOf: string,
  effective: string | null | undefined,
): "before" | "on_or_after" | "unknown" {
  const a = parseDate(asOf);
  const e = parseDate(effective);
  if (!a || !e || !Number.isFinite(a.getTime()) || !Number.isFinite(e.getTime())) return "unknown";
  return a.getTime() < e.getTime() ? "before" : "on_or_after";
}

function ruleMatchesJurisdiction(
  rule: RuleRecord,
  geo: GeocodeResult,
): boolean {
  const j = rule.jurisdiction.trim();
  if (rule.level === "state") {
    if (j === geo.state) return true;
    if (j === "CA" || /California/i.test(j)) return geo.state === "CA";
    if (j === "NJ" || /New Jersey/i.test(j)) return geo.state === "NJ";
    if (j === "MA" || /Massachusetts/i.test(j)) return geo.state === "MA";
    return false;
  }
  // city level — never apply on postal-only / untrusted geocodes
  if (!isTrustedLegalCity(geo)) return false;
  const cityPart = j.split(",")[0]?.trim() ?? j;
  return cityPart.toLowerCase() === geo.legal_city.toLowerCase();
}

function coverageText(rule: RuleRecord): string {
  return coveragePlainText(rule.coverage_conditions);
}

type EvalResult = Omit<LookupEntry, "team_rule_id"> & {
  omit?: boolean;
};

/**
 * Standalone date evaluation for a rule as of a query date.
 * Returns an early lookup result when status alone decides the outcome;
 * null means continue into coverage / "applies" evaluation.
 */
export function evaluateStatus(
  rule: RuleRecord,
  asOf: string,
): EvalResult | null {
  AsOfDateSchema.parse(asOf);
  if (rule.status === "failed") {
    return { omit: true, result: "pending", explanation: "", conflict_flag: false };
  }
  if (rule.status === "pending") {
    return {
      result: "pending",
      explanation: `${rule.title} is pending legislation, not in force as of ${asOf}.`,
      conflict_flag: Boolean(rule.conflict_flag),
    };
  }
  if (rule.status === "not_yet_effective") {
    const cmp = compareAsOf(asOf, rule.effective_date);
    if (cmp === "on_or_after") {
      return null; // treat as potentially applies below
    }
    return {
      result: "not_yet_effective",
      explanation: `${rule.title} is enacted but not effective until ${rule.effective_date ?? "a future date"} (query date ${asOf}).`,
      conflict_flag: Boolean(rule.conflict_flag),
    };
  }
  // in_force — still respect effective_date if present
  if (rule.effective_date) {
    const cmp = compareAsOf(asOf, rule.effective_date);
    if (cmp === "before") {
      return {
        result: "not_yet_effective",
        explanation: `${rule.title} effective date ${rule.effective_date} is after ${asOf}.`,
        conflict_flag: Boolean(rule.conflict_flag),
      };
    }
  }
  return null;
}

/** True when coverage/exemptions hinge on a numeric unit threshold or multifamily shape. */
function dependsOnUnitCount(cov: string, blob: string): boolean {
  return (
    /\d+\s*\+?\s*units\b/i.test(blob) ||
    /fewer than \d+.*(?:rental\s+)?units/i.test(blob) ||
    /more than \d+\s+(?:rental\s+)?units/i.test(blob) ||
    /\d+\s*or fewer.*(?:rental\s+)?units/i.test(blob) ||
    /1\s*[–-]\s*4\s*unit/i.test(blob) ||
    /\bunit count\b/i.test(blob) ||
    /\bmultifamily\b/i.test(cov)
  );
}

function evaluateBuildingFacts(
  rule: RuleRecord,
  addr: SampleAddress,
  geo: GeocodeResult,
  asOf: string,
): EvalResult | null {
  // Prefer machine-executable dual coverage when present.
  // Recompile legacy fixed-year predicates for rolling exemptions.
  const executable = /santa ana/i.test(rule.jurisdiction) && rule.category === "just_cause_eviction"
    ? compileCoverageConditions(rule) : executableFromRule(rule);
  if (executable) {
    const hit = evaluateExecutableCoverage(executable, addr, geo, asOf);
    if (hit?.kind === "omit") {
      return { omit: true, result: "applies", explanation: "", conflict_flag: false };
    }
    if (hit?.kind === "unknown") {
      return {
        result: "unknown",
        explanation: hit.reason,
        conflict_flag: Boolean(rule.conflict_flag),
      };
    }
    if (hit?.kind === "fail") {
      return { omit: true, result: "applies", explanation: "", conflict_flag: false };
    }
    // Passed executable guards — still run prose for compile gaps (e.g. multifamily year).
  }

  const year = parseOptionalInt(addr.year_built);
  const units = parseOptionalInt(addr.units);
  const cov = coverageText(rule).toLowerCase();
  const ex = (rule.exemptions || "").toLowerCase();
  const blob = `${cov} ${ex} ${rule.requirement}`.toLowerCase();

  // SF COO cutoff
  if (
    /san francisco/i.test(rule.jurisdiction) &&
    rule.category === "rent_increase_limits"
  ) {
    if (year == null) {
      return {
        result: "unknown",
        explanation:
          "SF Rent Ordinance coverage depends on certificate of occupancy; year_built is missing.",
        conflict_flag: false,
      };
    }
    if (year === 1979) {
      return {
        result: "unknown",
        explanation:
          "Building year is 1979 (SF COO cutoff 1979-06-13); certificate of occupancy date is not in the data.",
        conflict_flag: false,
      };
    }
    if (year > 1979) {
      return { omit: true, result: "applies", explanation: "", conflict_flag: false };
    }
  }

  // LA RSO COO cutoff
  if (
    /los angeles/i.test(rule.jurisdiction) &&
    rule.category === "rent_increase_limits"
  ) {
    if (year == null) {
      return {
        result: "unknown",
        explanation:
          "LA RSO coverage depends on certificate of occupancy; year_built is missing.",
        conflict_flag: false,
      };
    }
    if (year === 1978) {
      return {
        result: "unknown",
        explanation:
          "Building year is 1978 (LA COO cutoff 1978-10-01); certificate of occupancy date is not in the data.",
        conflict_flag: false,
      };
    }
    if (year > 1978) {
      return { omit: true, result: "applies", explanation: "", conflict_flag: false };
    }
  }

  // New construction / 15-year exemption (CA AB 1482 style)
  if (
    rule.level === "state" &&
    rule.jurisdiction === "CA" &&
    (rule.category === "rent_increase_limits" ||
      rule.category === "just_cause_eviction") &&
    /15 year|fifteen year|certificate of occupancy within/i.test(blob)
  ) {
    if (year == null) {
      return {
        result: "unknown",
        explanation:
          "Statewide coverage may depend on certificate-of-occupancy age; year_built is missing.",
        conflict_flag: false,
      };
    }
  }

  // Santa Ana just-cause: housing produced in the last 15 years is exempt (D085)
  if (
    /santa ana/i.test(rule.jurisdiction) &&
    rule.category === "just_cause_eviction" &&
    /15 year|last 15 years|housing produced/i.test(blob)
  ) {
    if (year == null) {
      return {
        result: "unknown",
        explanation:
          "Santa Ana just-cause coverage excludes housing produced in the last 15 years; year_built is missing.",
        conflict_flag: false,
      };
    }
    const boundary = Number(asOf.slice(0, 4)) - 15;
    if (year === boundary) return { result: "unknown", explanation: "Only the building year is known; the production date is needed at the 15-year boundary.", conflict_flag: Boolean(rule.conflict_flag) };
    if (year > boundary) {
      return { omit: true, result: "applies", explanation: "", conflict_flag: false };
    }
  }

  // "Multifamily … built before YYYY" / "built before YYYY"
  const beforeMatch = cov.match(
    /(?:multifamily\s+)?(?:properties\s+)?built before (\d{4})/i,
  );
  if (beforeMatch) {
    const cutoff = Number(beforeMatch[1]);
    if (year == null) {
      return {
        result: "unknown",
        explanation: `Coverage is limited to buildings built before ${cutoff}; year_built is missing.`,
        conflict_flag: false,
      };
    }
    if (year >= cutoff) {
      return { omit: true, result: "applies", explanation: "", conflict_flag: false };
    }
  }

  // Unit-count dependent exemptions
  if (
    /owner-occupied|2 or fewer|two or fewer|small-landlord|no more than two rental/i.test(
      blob,
    )
  ) {
    // No owner names in data — if units are high enough, exception cannot apply
    if (units != null && units >= 5) {
      // exception cannot apply; rule applies
      return null;
    }
    if (
      rule.category === "security_deposits" ||
      /owner-occupied|small-landlord/i.test(blob)
    ) {
      if (units == null) {
        return {
          result: "unknown",
          explanation:
            "Coverage or exemption may depend on unit count and/or owner type; units and owner identity are not available for this address.",
          conflict_flag: false,
        };
      }
      // units present but < 5 — owner type still unknown for small-landlord
      if (/small-landlord|owner of no more than two|owner-occupied/i.test(blob)) {
        return {
          result: "unknown",
          explanation:
            "A small-landlord or owner-occupied exemption may apply, but owner identity is not in the sample data.",
          conflict_flag: false,
        };
      }
    }
  }

  // Portfolio / building unit thresholds (any category) — unknown when units missing
  if (units == null && dependsOnUnitCount(cov, blob)) {
    return {
      result: "unknown",
      explanation:
        "Rule coverage or an exemption depends on unit count, which is missing for this address.",
      conflict_flag: false,
    };
  }

  return null;
}

function isLocalRentControl(rule: RuleRecord): boolean {
  return (
    rule.level === "city" &&
    rule.category === "rent_increase_limits" &&
    rule.status === "in_force"
  );
}

/** True only for the CA statewide rent-cap provision — not notice/remedies siblings under §1947.12. */
function isStateRentCap(rule: RuleRecord): boolean {
  if (
    rule.level !== "state" ||
    rule.category !== "rent_increase_limits" ||
    !(rule.jurisdiction === "CA" || /California/i.test(rule.jurisdiction))
  ) {
    return false;
  }
  // Notice (e) and remedies (k) remain applicable alongside local rent control.
  if (/1947\.12\s*\([ek]\)/i.test(rule.citation)) return false;
  const citeTitle = `${rule.citation} ${rule.title}`;
  return (
    /1947\.12\s*\(a\)/i.test(rule.citation) ||
    /AB\s*1482|statewide rent (increase )?cap|rent (increase )?cap/i.test(
      citeTitle,
    )
  );
}

export function evaluateAddress(options: {
  address: SampleAddress;
  geo: GeocodeResult;
  rules: RuleRecord[];
  asOf?: string;
  /** When true, emit explicit does_not_apply rows instead of omitting non-coverage. */
  includeNonApplicable?: boolean;
  /** Session-scoped building fact overrides for coverage preview (not corpus truth). */
  addressOverrides?: { year_built?: string; units?: string };
}): LookupEntry[] {
  const asOf = options.asOf || DEFAULT_AS_OF;
  AsOfDateSchema.parse(asOf);
  const { geo, rules } = options;
  const address: SampleAddress = {
    ...options.address,
    ...(options.addressOverrides?.year_built != null
      ? { year_built: String(options.addressOverrides.year_built) }
      : {}),
    ...(options.addressOverrides?.units != null
      ? { units: String(options.addressOverrides.units) }
      : {}),
  };
  const includeNonApplicable = Boolean(options.includeNonApplicable);

  const candidates = rules.filter((r) => ruleMatchesJurisdiction(r, geo));
  const entries: LookupEntry[] = [];

  // First pass evaluations
  const prelim: { rule: RuleRecord; entry: LookupEntry }[] = [];

  for (const rule of candidates) {
    if (rule.status === "failed") {
      if (includeNonApplicable) {
        prelim.push({
          rule,
          entry: {
            team_rule_id: rule.team_rule_id,
            result: "does_not_apply",
            explanation: `${rule.title} is recorded as failed/struck and is not treated as operative law as of ${asOf}.`,
            conflict_flag: false,
          },
        });
      }
      continue;
    }

    const statusHit = evaluateStatus(rule, asOf);
    if (statusHit?.omit) {
      if (includeNonApplicable) {
        prelim.push({
          rule,
          entry: {
            team_rule_id: rule.team_rule_id,
            result: "does_not_apply",
            explanation:
              statusHit.explanation ||
              `${rule.title} does not apply as of ${asOf}.`,
            conflict_flag: statusHit.conflict_flag,
          },
        });
      }
      continue;
    }
    if (statusHit) {
      prelim.push({
        rule,
        entry: {
          team_rule_id: rule.team_rule_id,
          result: statusHit.result,
          explanation: statusHit.explanation,
          conflict_flag: statusHit.conflict_flag,
        },
      });
      continue;
    }

    const factHit = evaluateBuildingFacts(rule, address, geo, asOf);
    if (factHit?.omit) {
      if (includeNonApplicable) {
        prelim.push({
          rule,
          entry: {
            team_rule_id: rule.team_rule_id,
            result: "does_not_apply",
            explanation: `${rule.title} coverage conditions are not met for this address as of ${asOf} (e.g. year built, unit count, or exemption).`,
            conflict_flag: Boolean(rule.conflict_flag),
          },
        });
      }
      continue;
    }
    if (factHit) {
      prelim.push({
        rule,
        entry: {
          team_rule_id: rule.team_rule_id,
          result: factHit.result,
          explanation: factHit.explanation,
          conflict_flag: factHit.conflict_flag || Boolean(rule.conflict_flag),
        },
      });
      continue;
    }

    prelim.push({
      rule,
      entry: {
        team_rule_id: rule.team_rule_id,
        result: "applies",
        explanation: `${rule.title} covers this address in ${geo.legal_city}, ${geo.state} as of ${asOf}. ${rule.citation}`,
        conflict_flag: Boolean(rule.conflict_flag),
      },
    });
  }

  // Local rent control supersedes CA state cap
  const localRentApplies = prelim.some(
    (p) =>
      isLocalRentControl(p.rule) &&
      p.entry.result === "applies",
  );
  const localRentUnknown = prelim.some((p) => isLocalRentControl(p.rule) && p.entry.result === "unknown");

  for (const p of prelim) {
    let entry = p.entry;
    if (!localRentApplies && localRentUnknown && isStateRentCap(p.rule) && entry.result === "applies") {
      entry = { ...entry, result: "unknown", explanation: "Local rent coverage is unresolved; whether the statewide cap is displaced cannot be determined from the available property facts." };
    }
    if (
      localRentApplies &&
      isStateRentCap(p.rule) &&
      entry.result === "applies"
    ) {
      entry = {
        ...entry,
        result: "superseded",
        explanation: `${p.rule.title} is superseded by local rent control for this address. ${p.rule.interaction || ""}`.trim(),
      };
    }
    // NJ FAIR conflict with local bans when FAIR applies or is NTE
    if (
      p.rule.alias_id === "NJ-ALG-01" ||
      (p.rule.category === "algorithmic_rent_setting" &&
        p.rule.level === "state" &&
        /FAIR/i.test(p.rule.title + p.rule.citation))
    ) {
      const hasLocalAlg = prelim.some(
        (x) =>
          x.rule.level === "city" &&
          x.rule.category === "algorithmic_rent_setting" &&
          (x.rule.alias_id === "JC-ALG-01" ||
            x.rule.alias_id === "HOB-ALG-01" ||
            /Jersey City|Hoboken/i.test(x.rule.jurisdiction)),
      );
      if (hasLocalAlg) {
        entry = {
          ...entry,
          conflict_flag: true,
          explanation:
            entry.explanation +
            " Possible conflict/preemption with local algorithmic rent bans when FAIR Act is effective.",
        };
      }
    }
    entry = {
      ...entry,
      explanation: withOpenQuestionNote(p.rule, entry.explanation),
    };
    entries.push(enrichEntry(entry, p.rule, address, geo, asOf));
  }

  // Deterministic ordering by team_rule_id for reproducible lookups.json
  return entries.sort((a, b) => a.team_rule_id.localeCompare(b.team_rule_id));
}

export function applyAll(options: {
  addresses: SampleAddress[];
  geos: Map<string, GeocodeResult>;
  rules: RuleRecord[];
  asOf?: string;
  includeNonApplicable?: boolean;
}): Record<string, LookupEntry[]> {
  const asOf = options.asOf || DEFAULT_AS_OF;
  const lookups: Record<string, LookupEntry[]> = {};
  for (const addr of options.addresses) {
    const geo = options.geos.get(addr.address_id);
    if (!geo) {
      lookups[addr.address_id] = [];
      continue;
    }
    // Pack submission lookups omit does_not_apply rows (organizer template).
    const rows = evaluateAddress({
      address: addr,
      geo,
      rules: options.rules,
      asOf,
      includeNonApplicable: options.includeNonApplicable,
    });
    lookups[addr.address_id] = options.includeNonApplicable
      ? rows
      : rows.filter((r) => r.result !== "does_not_apply");
  }
  return lookups;
}
