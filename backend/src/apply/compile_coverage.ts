import {
  coveragePlainText,
  type CoverageConditionsObject,
  type CoveragePredicate,
  type RuleRecord,
} from "@rhl/shared";

function jurisdictionAll(rule: RuleRecord): CoveragePredicate[] {
  if (rule.level === "state") {
    const state =
      rule.jurisdiction === "CA" || /California/i.test(rule.jurisdiction)
        ? "CA"
        : rule.jurisdiction === "NJ" || /New Jersey/i.test(rule.jurisdiction)
          ? "NJ"
          : rule.jurisdiction === "MA" || /Massachusetts/i.test(rule.jurisdiction)
            ? "MA"
            : rule.jurisdiction;
    return [{ field: "state", operator: "eq", value: state }];
  }
  const city = (rule.jurisdiction.split(",")[0] || rule.jurisdiction).trim();
  return [{ field: "legal_city", operator: "eq", value: city }];
}

/**
 * Compile dual coverage: keep human `text`, attach executable predicates.
 * Mirrors the deterministic heuristics already used in coverage.ts.
 */
export function compileCoverageConditions(
  rule: RuleRecord,
): CoverageConditionsObject {
  const existingText = coveragePlainText(rule.coverage_conditions);
  const text =
    existingText ||
    [rule.coverage_conditions, rule.exemptions, rule.requirement]
      .filter((x) => typeof x === "string" && x)
      .join(" ")
      .trim() ||
    rule.title;

  const all = jurisdictionAll(rule);
  const unknown_if: CoveragePredicate[] = [];
  const omit_if: CoveragePredicate[] = [];

  const blob = `${text} ${rule.exemptions || ""} ${rule.requirement}`.toLowerCase();

  if (
    /san francisco/i.test(rule.jurisdiction) &&
    rule.category === "rent_increase_limits"
  ) {
    unknown_if.push(
      {
        field: "year_built",
        operator: "missing",
        reason:
          "SF Rent Ordinance coverage depends on certificate of occupancy; year_built is missing.",
      },
      {
        field: "year_built",
        operator: "eq",
        value: 1979,
        reason:
          "Building year is 1979 (SF COO cutoff 1979-06-13); certificate of occupancy date is not in the data.",
      },
    );
    omit_if.push({ field: "year_built", operator: "gt", value: 1979 });
  }

  if (
    /los angeles/i.test(rule.jurisdiction) &&
    rule.category === "rent_increase_limits"
  ) {
    unknown_if.push(
      {
        field: "year_built",
        operator: "missing",
        reason:
          "LA RSO coverage depends on certificate of occupancy; year_built is missing.",
      },
      {
        field: "year_built",
        operator: "eq",
        value: 1978,
        reason:
          "Building year is 1978 (LA COO cutoff 1978-10-01); certificate of occupancy date is not in the data.",
      },
    );
    omit_if.push({ field: "year_built", operator: "gt", value: 1978 });
  }

  if (
    rule.level === "state" &&
    (rule.jurisdiction === "CA" || /California/i.test(rule.jurisdiction)) &&
    (rule.category === "rent_increase_limits" ||
      rule.category === "just_cause_eviction") &&
    /15 year|fifteen year|certificate of occupancy within/i.test(blob)
  ) {
    unknown_if.push({
      field: "year_built",
      operator: "missing",
      reason:
        "Statewide coverage may depend on certificate-of-occupancy age; year_built is missing.",
    });
  }

  if (
    /santa ana/i.test(rule.jurisdiction) &&
    rule.category === "just_cause_eviction" &&
    /15 year|last 15 years|housing produced/i.test(blob)
  ) {
    unknown_if.push({
      field: "year_built",
      operator: "missing",
      reason:
        "Santa Ana just-cause coverage excludes housing produced in the last 15 years; year_built is missing.",
    });
    unknown_if.push({ field: "year_built", operator: "boundary_years", value: 15, reason: "Only the building year is known; the production date is needed at the 15-year boundary." });
    omit_if.push({ field: "year_built", operator: "within_years", value: 15 });
  }

  if (
    /owner-occupied|2 or fewer|two or fewer|small-landlord|no more than two rental/i.test(
      blob,
    )
  ) {
    if (
      rule.category === "security_deposits" ||
      /owner-occupied|small-landlord/i.test(blob)
    ) {
      unknown_if.push({
        field: "units",
        operator: "missing",
        reason:
          "Coverage or exemption may depend on unit count and/or owner type; units and owner identity are not available for this address.",
      });
      unknown_if.push({
        field: "owner_type",
        operator: "missing",
        reason:
          "A small-landlord or owner-occupied exemption may apply, but owner identity is not in the sample data.",
      });
    }
  }

  const beforeMatch = text.match(
    /(?:multifamily\s+)?(?:properties\s+)?built before (\d{4})/i,
  );
  if (beforeMatch) {
    const cutoff = Number(beforeMatch[1]);
    unknown_if.push({
      field: "year_built",
      operator: "missing",
      reason: `Coverage is limited to buildings built before ${cutoff}; year_built is missing.`,
    });
    omit_if.push({ field: "year_built", operator: "gte", value: cutoff });
  }

  const unitThreshold =
    /\d+\s*\+?\s*units\b/i.test(blob) ||
    /fewer than \d+.*(?:rental\s+)?units/i.test(blob) ||
    /more than \d+\s+(?:rental\s+)?units/i.test(blob) ||
    /\d+\s*or fewer.*(?:rental\s+)?units/i.test(blob) ||
    /1\s*[–-]\s*4\s*unit/i.test(blob) ||
    /\bunit count\b/i.test(blob) ||
    /\bmultifamily\b/i.test(text);

  if (
    unitThreshold &&
    !unknown_if.some((p) => p.field === "units" && p.operator === "missing")
  ) {
    unknown_if.push({
      field: "units",
      operator: "missing",
      reason:
        "Rule coverage or an exemption depends on unit count, which is missing for this address.",
    });
  }

  return {
    text,
    all,
    ...(unknown_if.length ? { unknown_if } : {}),
    ...(omit_if.length ? { omit_if } : {}),
  };
}

export function enrichRuleCoverage(rule: RuleRecord): RuleRecord {
  return {
    ...rule,
    coverage_conditions: compileCoverageConditions(rule),
  };
}
