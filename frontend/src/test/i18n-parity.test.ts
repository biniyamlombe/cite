import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getStrings, listStringKeys } from "@/lib/i18n";
import { fmtDate } from "@/lib/cite/labels";

const GLOSSARY = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../data/localization/legal_housing_glossary.en-es.json"),
    "utf8",
  ),
) as {
  terms: Array<{ id: string; en: string; es: string; prohibited: string[] }>;
};

describe("i18n key parity", () => {
  it("has matching en/es key sets", () => {
    const keys = listStringKeys();
    const en = getStrings("en-US");
    const es = getStrings("es-US");
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    expect(keys.length).toBeGreaterThan(600);
  });

  it("does not leave raw translation keys in Spanish tables", () => {
    const es = getStrings("es-US");
    for (const [k, v] of Object.entries(es)) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(v, k).not.toBe(k);
    }
  });

  it("keeps unknown distinct from does-not-apply in Spanish", () => {
    const es = getStrings("es-US");
    expect(es["result.unknown"].toLowerCase()).not.toMatch(/no aplica|no parece aplicar|no existe/);
    expect(es["result.unknown"].toLowerCase()).toMatch(/faltan datos|no se puede determinar/);
    expect(es["result.does_not_apply"].toLowerCase()).toContain("no parece aplicar");
  });

  it("keeps pending / not-yet-effective distinct from in-force", () => {
    const es = getStrings("es-US");
    expect(es["status.in_force"]).toMatch(/Vigente/i);
    expect(es["status.not_yet_effective"]).toMatch(/aún no/i);
    expect(es["status.pending"]).toMatch(/Pendiente/i);
    expect(es["status.failed"]).toMatch(/anulada|rechazada/i);
    expect(es["status.not_yet_effective"]).not.toBe(es["status.in_force"]);
    expect(es["status.pending"]).not.toBe(es["status.in_force"]);
  });

  it("includes Spanish not-legal-advice disclaimer", () => {
    const es = getStrings("es-US");
    expect(es.disclaimer.toLowerCase()).toMatch(/no (es )?asesor/);
    expect(es["disclaimer.short"].toLowerCase()).toMatch(/no (es )?asesor/);
  });

  it("formats legal dates unambiguously for en-US and es-US", () => {
    expect(fmtDate("2026-01-02", "en-US")).toMatch(/January/);
    expect(fmtDate("2026-01-02", "es-US")).toMatch(/enero/i);
    expect(fmtDate("2026-01-02", "en-US")).not.toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});

describe("glossary safety", () => {
  it("defines required critical terms", () => {
    const ids = new Set(GLOSSARY.terms.map((t) => t.id));
    for (const id of [
      "unknown",
      "applies",
      "does_not_apply",
      "needs_human_review",
      "pending",
      "not_yet_effective",
      "not_legal_advice",
      "just_cause_eviction",
      "as_of_date",
      "source_quote",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("lists prohibited unsafe unknown translations", () => {
    const unknown = GLOSSARY.terms.find((t) => t.id === "unknown");
    expect(unknown?.prohibited.join(" ")).toMatch(/no aplica/);
  });
});
