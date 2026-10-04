/** Deterministic spoken briefing text from lookup headlines. */
import type { LookupEntry, RuleRecord, SupportedLocale } from "@rhl/shared";

export function buildBriefing(opts: {
  addressLine: string;
  asOf: string;
  locale: SupportedLocale;
  entries: LookupEntry[];
  rulesById: Map<string, RuleRecord>;
  headlines?: Record<string, { headline_en: string; headline_es: string }>;
  persona?: "renter" | "owner";
}): { text: string; chapters: Array<{ label: string; start: number; end: number }> } {
  const { addressLine, asOf, locale, entries, rulesById, headlines, persona = "renter" } =
    opts;
  const es = locale === "es-US";
  const parts: string[] = [];
  const chapters: Array<{ label: string; start: number; end: number }> = [];

  const intro = es
    ? `Resumen para ${persona === "owner" ? "propietarios" : "inquilinos"} en ${addressLine}, a la fecha ${asOf}. No es asesoría legal.`
    : `Briefing for ${persona === "owner" ? "owners" : "renters"} at ${addressLine}, as of ${asOf}. Not legal advice.`;
  parts.push(intro);

  const applies = entries.filter((e) => e.result === "applies").slice(0, 6);
  for (const e of applies) {
    const rule = rulesById.get(e.team_rule_id);
    if (!rule) continue;
    const h = headlines?.[e.team_rule_id];
    const line = es
      ? h?.headline_es || rule.title
      : h?.headline_en || rule.title;
    const start = parts.join(" ").length + 1;
    parts.push(line);
    chapters.push({
      label: rule.category,
      start,
      end: parts.join(" ").length,
    });
  }

  if (applies.length === 0) {
    parts.push(
      es
        ? "No hay normas marcadas como aplicables con los hechos disponibles."
        : "No rules are marked as applying with the available facts.",
    );
  }

  parts.push(
    es
      ? "Lea las citas en la aplicación antes de tomar decisiones."
      : "Read the citations in the app before making decisions.",
  );

  return { text: parts.join(" "), chapters };
}
