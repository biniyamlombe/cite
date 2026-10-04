/**
 * Stable alias IDs used by change_tests.json and pack-honest soft-gap scaffolds.
 * Matched after extraction by citation / title / jurisdiction heuristics.
 */
export const CHANGE_TEST_ALIASES = [
  "CA-ALG-01",
  "HOB-ALG-01",
  "JC-ALG-01",
  "NJ-ALG-01",
  "MA-ALG-P1",
  "MA-ALG-P2",
  "MA-RENT-P1",
] as const;

/** Soft-gap screening scaffolds from thin-but-capturable corpus pages. */
export const SOFT_GAP_ALIASES = ["CAM-FH-01", "SF-FC-01"] as const;

export const STABLE_ALIASES = [
  ...CHANGE_TEST_ALIASES,
  ...SOFT_GAP_ALIASES,
] as const;

export type AliasId = (typeof STABLE_ALIASES)[number];

export function assignAliases<
  T extends {
    team_rule_id: string;
    title: string;
    citation: string;
    jurisdiction: string;
    category: string;
    status: string;
    requirement: string;
    level: string;
    alias_id?: string;
  },
>(rules: T[]): T[] {
  const matchers: Record<AliasId, (r: T) => boolean> = {
    "CA-ALG-01": (r) =>
      r.category === "algorithmic_rent_setting" &&
      r.level === "state" &&
      (r.jurisdiction === "CA" || /California/i.test(r.jurisdiction)) &&
      /AB\s*325|SB\s*763|antitrust|common pricing|pricing algorithm/i.test(
        `${r.title} ${r.citation} ${r.requirement}`,
      ),
    "HOB-ALG-01": (r) =>
      r.category === "algorithmic_rent_setting" &&
      /Hoboken/i.test(r.jurisdiction) &&
      r.status !== "pending" &&
      r.status !== "failed",
    "JC-ALG-01": (r) =>
      r.category === "algorithmic_rent_setting" &&
      /Jersey City/i.test(r.jurisdiction) &&
      r.status !== "pending" &&
      r.status !== "failed",
    "NJ-ALG-01": (r) =>
      r.category === "algorithmic_rent_setting" &&
      r.level === "state" &&
      (r.jurisdiction === "NJ" || /New Jersey/i.test(r.jurisdiction)) &&
      /FAIR/i.test(`${r.title} ${r.citation} ${r.requirement}`),
    "MA-ALG-P1": (r) =>
      r.category === "algorithmic_rent_setting" &&
      (r.jurisdiction === "MA" || /Massachusetts/i.test(r.jurisdiction)) &&
      r.status === "pending" &&
      /S\.?\s*2983/i.test(`${r.title} ${r.citation} ${r.requirement}`),
    "MA-ALG-P2": (r) =>
      r.category === "algorithmic_rent_setting" &&
      (r.jurisdiction === "MA" || /Massachusetts/i.test(r.jurisdiction)) &&
      r.status === "pending" &&
      /H\.?\s*5222/i.test(`${r.title} ${r.citation} ${r.requirement}`),
    "MA-RENT-P1": (r) =>
      r.category === "rent_increase_limits" &&
      (r.jurisdiction === "MA" || /Massachusetts/i.test(r.jurisdiction)) &&
      (r.status === "failed" ||
        /ballot|IP\s*25|Initiative/i.test(`${r.title} ${r.citation} ${r.requirement}`)),
    "CAM-FH-01": (r) =>
      r.category === "screening_restrictions" &&
      /Cambridge/i.test(r.jurisdiction) &&
      /Fair Housing|source of income|Section 8/i.test(
        `${r.title} ${r.citation} ${r.requirement}`,
      ),
    "SF-FC-01": (r) =>
      r.category === "screening_restrictions" &&
      /San Francisco/i.test(r.jurisdiction) &&
      /Fair Chance|arrest or conviction|criminal history/i.test(
        `${r.title} ${r.citation} ${r.requirement}`,
      ),
  };

  const out = rules.map((r) => ({ ...r }));
  for (const alias of STABLE_ALIASES) {
    const hit = out.find((r) => !r.alias_id && matchers[alias](r));
    if (hit) hit.alias_id = alias;
  }
  // Keep a single rule per alias (highest confidence wins).
  const bestByAlias = new Map<string, (typeof out)[number]>();
  for (const r of out) {
    if (!r.alias_id) continue;
    const prev = bestByAlias.get(r.alias_id);
    const score = typeof (r as { confidence?: number }).confidence === "number"
      ? ((r as { confidence?: number }).confidence as number)
      : 0;
    const prevScore =
      prev && typeof (prev as { confidence?: number }).confidence === "number"
        ? ((prev as { confidence?: number }).confidence as number)
        : -1;
    if (!prev || score > prevScore) bestByAlias.set(r.alias_id, r);
  }
  return out.filter((r) => {
    if (!r.alias_id) return true;
    return bestByAlias.get(r.alias_id) === r;
  });
}
