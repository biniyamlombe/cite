import { describe, expect, it, vi, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AsOfDateSchema, ChangesResponseSchema, LookupResponseSchema } from "@rhl/shared";
import { MOCK_RULES, MOCK_CHANGES, mockLookup, mockRuleVersions } from "@/mocks/cite";
import { approachingEffective, changesBetween, summarizeLookup } from "@/lib/cite/lookup-diff";
import { HttpCiteApiClient } from "@/lib/cite/client";

afterEach(() => vi.unstubAllGlobals());
describe("corpus-backed offline demo", () => {
  it("preserves the judge addresses and honest determinations", () => {
    const berkeley = mockLookup("A0005", "2026-10-01")!;
    expect(berkeley.address.postal_city).toBe("Berkeley");
    expect(berkeley.results.some((r) => r.result === "unknown")).toBe(true);
    expect(mockLookup("A0065", "2026-10-01")!.jurisdiction.city).toBe("Boston");
    const hoboken = mockLookup("A0002", "2026-10-01")!;
    expect(hoboken.jurisdiction.city).toBe("Hoboken");
    expect(hoboken.results.find((r) => r.rule?.alias_id === "HOB-ALG-01")?.result).toBe("applies");
    expect(mockLookup("SA0001", "2026-10-01")!.jurisdiction.city).toBe("Santa Ana");
    expect(mockLookup("A0500", "2026-10-01")).not.toBeNull();
    for (const id of ["A0005", "A0065", "A0002", "SA0001"])
      expect(LookupResponseSchema.safeParse(mockLookup(id, "2026-10-01")).success).toBe(true);
    expect(ChangesResponseSchema.safeParse(MOCK_CHANGES).success).toBe(true);
  });
  it("uses exact quotes and stored version records", () => {
    for (const rule of MOCK_RULES) {
      const packPath = `../data/pack/corpus/text/${rule.source_doc_id}.txt`;
      const secondaryPath = `../data/stretch/secondary_corpus/${rule.source_doc_id}.txt`;
      const source = existsSync(packPath)
        ? readFileSync(packPath, "utf8")
        : readFileSync(secondaryPath, "utf8");
      expect(source.includes(rule.quoted_span), rule.team_rule_id).toBe(true);
    }
    const history = JSON.parse(readFileSync("../outputs/rule_versions.json", "utf8"));
    const hob = MOCK_RULES.find((r) => r.alias_id === "HOB-ALG-01")!;
    expect(mockRuleVersions(hob.team_rule_id)).toEqual(history.by_key["alias:HOB-ALG-01"]);
  });
  it("rejects unrecorded and invalid dates", () => {
    expect(() => mockLookup("A0005", "2030-01-01")).toThrow(/snapshot unavailable/);
    expect(AsOfDateSchema.safeParse("2026-02-29").success).toBe(false);
  });
});
describe("result comparison", () => {
  const before = mockLookup("A0002", "2026-10-01")!;
  it("captures removals, additions, conflict-only and evidence-only changes", () => {
    const after = structuredClone(before);
    after.results.shift();
    after.results[0]!.conflict_flag = !after.results[0]!.conflict_flag;
    after.results[1]!.rule!.quoted_span += " test alteration";
    expect(changesBetween(before, after)).toHaveLength(3);
    expect(changesBetween(after, before)).toHaveLength(3);
  });
  it("does not invent changes when team rule IDs are renumbered", () => {
    const after = structuredClone(before);
    after.results.forEach((r, i) => {
      r.team_rule_id = `renumbered-${i}`;
    });
    expect(summarizeLookup(after)).toEqual(summarizeLookup(before));
    expect(changesBetween(before, after)).toEqual([]);
  });
  it("lists pending/NTE effective dates inside the alert horizon", () => {
    const sample = structuredClone(before);
    const row = sample.results[0]!;
    row.result = "not_yet_effective";
    row.rule = {
      ...row.rule!,
      effective_date: "2027-03-01",
    };
    const hits = approachingEffective(sample, "2026-10-01", "2027-10-01");
    expect(hits.some((h) => h.date === "2027-03-01")).toBe(true);
    expect(approachingEffective(sample, "2026-10-01", "2026-10-15")).toEqual([]);
  });
});
it("rejects malformed API responses and does not disguise version failure as empty history", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }))));
  const client = new HttpCiteApiClient("https://example.invalid");
  await expect(client.lookup("A0005", "2026-10-01")).rejects.toThrow();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failed", { status: 503 })));
  await expect(client.ruleVersions("r-0001")).rejects.toMatchObject({
    name: "CiteApiError",
    status: 503,
    retryable: true,
  });
});
