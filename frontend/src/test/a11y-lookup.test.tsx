import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { StatusBadge, ResultSummaryChips } from "@/components/cite/status";
import { LocaleProvider } from "@/lib/i18n";
import type { LookupResult, Rule } from "@/lib/cite/types";

describe("lookup a11y smoke", () => {
  it("status chips have no serious axe violations (excluding color-contrast in jsdom)", async () => {
    const rule = { title: "Sample", category: "rent_increase_limits" } as Rule;
    const results: LookupResult[] = [
      {
        team_rule_id: "1",
        result: "applies",
        explanation: "Based on available records.",
        conflict_flag: false,
        rule,
      },
      {
        team_rule_id: "2",
        result: "unknown",
        explanation: "Missing year_built.",
        conflict_flag: false,
        facts_missing: ["year_built"],
        rule,
      },
    ];
    const { container } = render(
      <LocaleProvider>
        <main>
          <h1>Lookup</h1>
          <StatusBadge value="applies" kind="applicability" />
          <ResultSummaryChips results={results} />
        </main>
      </LocaleProvider>,
    );
    const resultsAxe = await axe(container, {
      rules: {
        // jsdom lacks canvas; contrast checks are covered manually in UX_TEST_CHECKLIST.
        "color-contrast": { enabled: false },
      },
    });
    expect(
      resultsAxe.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
    ).toEqual([]);
  });
});
