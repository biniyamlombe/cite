import { describe, expect, it } from "vitest";
import { isLinkOnlyScaffold, isSoftGapScaffold } from "@/components/cite/warnings";

describe("source honesty helpers", () => {
  it("does not label municipal ordinance extracts as link-only scaffolds", () => {
    expect(
      isLinkOnlyScaffold({
        extraction_method: "municipal_ordinance",
        conflict_note:
          "Primary sources (link-only, no capturable body): https://ecode360.com/…. Quoted evidence is the adopted Hoboken ordinance PDF (HOB-ORD-01).",
      }),
    ).toBe(false);
  });

  it("still flags true link-only scaffolds", () => {
    expect(
      isLinkOnlyScaffold({
        extraction_method: "link_only_scaffold",
        conflict_note: "link-only primary",
      }),
    ).toBe(true);
    expect(
      isLinkOnlyScaffold({
        evidence_status: "scenario_only",
        conflict_note: "scenario membership",
      }),
    ).toBe(true);
  });

  it("recognizes soft-gap screening scaffolds", () => {
    expect(isSoftGapScaffold({ extraction_method: "soft_gap_scaffold" })).toBe(true);
    expect(isSoftGapScaffold({ alias_id: "CAM-FH-01" })).toBe(true);
    expect(isSoftGapScaffold({ alias_id: "SF-FC-01" })).toBe(true);
    expect(isSoftGapScaffold({ alias_id: "HOB-ALG-01", extraction_method: "municipal_ordinance" })).toBe(
      false,
    );
  });
});
