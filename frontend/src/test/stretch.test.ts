import { describe, expect, it } from "vitest";
import { isStretchAddress, stretchDemoTip } from "@/lib/cite/stretch";
import { getStrings } from "@/lib/i18n";

describe("Santa Ana stretch helpers", () => {
  it("detects SA* demo addresses", () => {
    expect(isStretchAddress("SA0001")).toBe(true);
    expect(isStretchAddress("sa0003")).toBe(true);
    expect(isStretchAddress("A0005")).toBe(false);
  });

  it("picks the SA0001 vs SA0003 demo tip", () => {
    expect(stretchDemoTip("SA0001")).toBe("applies");
    expect(stretchDemoTip("SA0003")).toBe("exempt");
    expect(stretchDemoTip("SA0002")).toBe("generic");
  });

  it("has bilingual stretch chrome strings", () => {
    const en = getStrings("en-US");
    const es = getStrings("es-US");
    expect(en["stretch.badge"]).toBeTruthy();
    expect(es["stretch.badge"]).toBeTruthy();
    expect(en["lookup.demo.stretch"]).toMatch(/Santa Ana/i);
    expect(es["lookup.demo.stretch"]).toMatch(/Santa Ana/i);
  });
});
