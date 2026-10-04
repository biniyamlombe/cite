import { describe, expect, it } from "vitest";
import { groupKeyForResult, groupResults } from "@/lib/cite/result-groups";
import type { LookupResult, Rule } from "@/lib/cite/types";

const rule = { title: "R", category: "rent_increase_limits" } as Rule;

function entry(
  partial: Partial<LookupResult> & Pick<LookupResult, "result" | "team_rule_id">,
): LookupResult {
  const base: LookupResult = {
    team_rule_id: partial.team_rule_id,
    result: partial.result,
    explanation: "",
    conflict_flag: partial.conflict_flag ?? false,
    rule,
  };
  if (partial.needs_human_review != null) base.needs_human_review = partial.needs_human_review;
  if (partial.applicability != null) base.applicability = partial.applicability;
  return base;
}

describe("result groups", () => {
  it("keeps pending out of applies", () => {
    expect(groupKeyForResult(entry({ team_rule_id: "p", result: "pending" }))).toBe(
      "pending_future",
    );
    expect(groupKeyForResult(entry({ team_rule_id: "n", result: "not_yet_effective" }))).toBe(
      "pending_future",
    );
    expect(groupKeyForResult(entry({ team_rule_id: "a", result: "applies" }))).toBe("applies");
  });

  it("routes conflicts needing review away from plain applies", () => {
    expect(
      groupKeyForResult(
        entry({
          team_rule_id: "c",
          result: "applies",
          conflict_flag: true,
          needs_human_review: true,
        }),
      ),
    ).toBe("needs_human_review");
  });

  it("orders groups with pending last among operative sections", () => {
    const groups = groupResults([
      entry({ team_rule_id: "a", result: "pending" }),
      entry({ team_rule_id: "b", result: "applies" }),
      entry({ team_rule_id: "c", result: "unknown" }),
    ]);
    expect(groups.map(([k]) => k)).toEqual(["applies", "unknown", "pending_future"]);
  });
});
