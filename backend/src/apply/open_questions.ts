/**
 * Pack §9 "known open questions in the law" — surface them on matching lookups
 * so the system prefers honest ambiguity over a false single answer.
 */
import type { RuleRecord } from "@rhl/shared";

/** Short notes appended to lookup explanations when a rule touches an open question. */
export function openQuestionNote(rule: RuleRecord): string | null {
  const j = rule.jurisdiction;
  const blob = `${rule.title} ${rule.citation} ${rule.requirement}`.toLowerCase();

  // Berkeley algorithmic ban — two published effective dates in the wild.
  if (
    /berkeley/i.test(j) &&
    rule.category === "algorithmic_rent_setting"
  ) {
    return (
      "Open question: Berkeley's algorithmic ban (ch. 13.63) has two published effective dates " +
      "(ordinance text ~March 1, 2026 vs. some secondary alerts citing January 2026)."
    );
  }

  // LA RSO formula / annual increase — pack notes conflicting published dates.
  if (
    /los angeles/i.test(j) &&
    rule.category === "rent_increase_limits" &&
    /annual|allowable rent increase|rso/i.test(blob)
  ) {
    return (
      "Open question: Los Angeles RSO materials cite more than one published effective date " +
      "for the updated formula (e.g. LAHD 2026-02-02 vs. some landlord-association notices 2026-01-24)."
    );
  }

  // CA screening-fee dollar figure is not a single official 2026 amount in the pack.
  if (
    (j === "CA" || /California/i.test(j)) &&
    rule.category === "application_screening_fees" &&
    /cap|maximum|fee/i.test(blob)
  ) {
    return (
      "Open question: California's screening-fee cap has no single official 2026 dollar figure in the corpus."
    );
  }

  // NJ FAIR may preempt Hoboken / Jersey City local alg bans once effective.
  if (
    rule.alias_id === "NJ-ALG-01" ||
    (rule.category === "algorithmic_rent_setting" &&
      rule.level === "state" &&
      /FAIR/i.test(`${rule.title} ${rule.citation}`))
  ) {
    return (
      "Open question: New Jersey's FAIR Act may preempt Jersey City and Hoboken algorithmic ordinances once it takes effect."
    );
  }

  return null;
}

export function withOpenQuestionNote(
  rule: RuleRecord,
  explanation: string,
): string {
  const note = openQuestionNote(rule);
  if (!note) return explanation;
  if (explanation.includes("Open question:")) return explanation;
  return `${explanation} ${note}`.trim();
}
