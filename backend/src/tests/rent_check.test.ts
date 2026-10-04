import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuleRecord } from "@rhl/shared";
import { checkRentIncrease, parseRentCap, rentVerdict } from "../check/rent.js";

describe("rent check", () => {
  it("parses a simple percent cap", () => {
    const cap = parseRentCap("1.6%", "Annual allowable increase is 1.6%");
    assert.equal(cap.pct, 1.6);
  });

  it("flags CPI-only formulas as needing CPI", () => {
    const cap = parseRentCap("Increase limited by CPI change for the period");
    assert.equal(cap.need, "cpi");
  });

  it("marks an increase within the cap as ok", () => {
    const v = rentVerdict({
      currentRent: 2400,
      newRent: 2430,
      cap: { pct: 1.6, basis: "percent" },
      deciding: [
        {
          team_rule_id: "r-1",
          category: "rent_increase_limits",
          citation: "SF §37.3",
          quoted_span: "The annual allowable increase is 1.6 percent for covered units.",
          source_url: "https://example.test",
        } as RuleRecord,
      ],
    });
    assert.equal(v.kind, "ok");
  });

  it("marks an over-cap increase", () => {
    const rule = {
      team_rule_id: "r-1",
      category: "rent_increase_limits",
      key_value: "1.6%",
      requirement: "Cap 1.6%",
      title: "SF AGA",
      citation: "SF §37.3",
      quoted_span: "The annual allowable increase is 1.6 percent for covered units.",
      source_url: "https://example.test",
    } as RuleRecord;
    const v = checkRentIncrease({
      currentRent: 2400,
      newRent: 2600,
      entries: [{ team_rule_id: "r-1", result: "applies", explanation: "applies", conflict_flag: false }],
      rulesById: new Map([["r-1", rule]]),
    });
    assert.equal(v.kind, "over");
    assert.ok((v.values.over_amount ?? 0) > 0);
  });
});
