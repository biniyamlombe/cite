import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuleRecord } from "@rhl/shared";
import {
  buildPlainLanguageFile,
  buildPlainRecord,
  headlineForLookup,
} from "../plain/headlines.js";

function sample(partial: Partial<RuleRecord> = {}): RuleRecord {
  return {
    team_rule_id: "r-test",
    jurisdiction: "San Francisco, CA",
    level: "city",
    category: "rent_increase_limits",
    status: "in_force",
    title: "SF rent ordinance annual increase",
    requirement: "Covered units may not increase rent above the annual allowable increase of 1.6%.",
    key_value: "1.6%",
    citation: "SF Admin. Code §37.3",
    source_url: "https://example.test",
    quoted_span: "The annual allowable increase for covered units is 1.6 percent for the period.",
    conflict_flag: false,
    ...partial,
  };
}

describe("plain headlines", () => {
  it("builds a template headline that keeps known percentages", () => {
    const rec = buildPlainRecord(sample());
    assert.match(rec.headline_en, /1\.6%/);
    assert.equal(rec.source, "template");
  });

  it("prefixes pending status", () => {
    const rec = buildPlainRecord(sample({ status: "pending" }));
    assert.match(rec.headline_en, /^Pending — /);
    assert.match(rec.headline_es, /^Pendiente — /);
  });

  it("writes one record per rule", () => {
    const file = buildPlainLanguageFile([sample(), sample({ team_rule_id: "r-2" })]);
    assert.equal(file.count, 2);
    assert.ok(file.records["r-test"]);
  });

  it("adapts headline for unknown results", () => {
    const rec = buildPlainRecord(sample());
    const h = headlineForLookup({
      record: rec,
      result: "unknown",
      locale: "en-US",
      factsMissing: ["year_built"],
    });
    assert.match(h!.text, /year_built/);
  });
});
