import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuleRecord } from "@rhl/shared";
import { answerQuestion } from "../ask/ground.js";

describe("ask grounding", () => {
  const rule = {
    team_rule_id: "r-1",
    category: "rent_increase_limits",
    citation: "SF §37.3",
    quoted_span: "The annual allowable increase is 1.6 percent for covered units.",
    source_url: "https://example.test",
  } as RuleRecord;

  it("refuses evasion questions", () => {
    const a = answerQuestion({
      question: "How do I get around the rent cap?",
      entries: [
        { team_rule_id: "r-1", result: "applies", explanation: "x", conflict_flag: false },
      ],
      rulesById: new Map([["r-1", rule]]),
    });
    assert.equal(a.refused, true);
    assert.equal(a.refusal_reason, "evasion");
  });

  it("returns rent-rule citations for rent questions", () => {
    const a = answerQuestion({
      question: "What is the rent increase limit?",
      entries: [
        { team_rule_id: "r-1", result: "applies", explanation: "x", conflict_flag: false },
      ],
      rulesById: new Map([["r-1", rule]]),
      headlines: { "r-1": { headline_en: "Rent capped at 1.6%", headline_es: "Tope 1.6%" } },
    });
    assert.equal(a.refused, false);
    assert.match(a.answer, /1\.6%/);
    assert.equal(a.citations[0]?.team_rule_id, "r-1");
  });

  it("matches Spanish rent questions to the same citation", () => {
    const a = answerQuestion({
      question: "¿Cuál es el límite de aumento de renta?",
      entries: [
        { team_rule_id: "r-1", result: "applies", explanation: "x", conflict_flag: false },
      ],
      rulesById: new Map([["r-1", rule]]),
      headlines: { "r-1": { headline_en: "Rent capped at 1.6%", headline_es: "Tope 1.6%" } },
    });
    assert.equal(a.citations[0]?.team_rule_id, "r-1");
    assert.match(a.answer_es, /Tope 1\.6%/);
  });

  it("asks for a topic instead of dumping unrelated rules", () => {
    const a = answerQuestion({
      question: "What is the weather today?",
      entries: [
        { team_rule_id: "r-1", result: "applies", explanation: "x", conflict_flag: false },
      ],
      rulesById: new Map([["r-1", rule]]),
    });
    assert.equal(a.refused, false);
    assert.equal(a.citations.length, 0);
    assert.match(a.answer, /rent increases/);
    assert.match(a.answer_es, /aumentos de renta/);
  });
});
