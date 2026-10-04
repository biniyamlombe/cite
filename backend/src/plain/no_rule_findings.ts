/**
 * Companion findings for jurisdiction × category cells with no extracted rule.
 * Does not invent municipal text for link-only cities.
 */
import type { RuleCategory, RuleRecord } from "@rhl/shared";
import { CATEGORY_LABELS, PIPELINE_VERSION, RuleCategory as RuleCategoryEnum } from "@rhl/shared";

export type NoRuleKind = "no_rule_in_corpus" | "unverified_link_only";

export type NoRuleFinding = {
  finding_id: string;
  jurisdiction: string;
  level: "state" | "city";
  category: RuleCategory;
  kind: NoRuleKind;
  note: string;
  note_es: string;
  source_doc_ids: string[];
};

export type NoRuleFindingsFile = {
  generated_at: string;
  pipeline_version: string;
  count: number;
  findings: NoRuleFinding[];
};

const CATEGORIES = RuleCategoryEnum.options;

/** Cities whose primary ordinance pages are link-only / uncaptured in the pack. */
const LINK_ONLY_CITIES = new Set(["Hoboken, NJ", "Jersey City, NJ"]);

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildNoRuleFindings(rules: RuleRecord[]): NoRuleFindingsFile {
  const present = new Map<string, Set<RuleCategory>>();
  const docsByJuris = new Map<string, Set<string>>();

  for (const rule of rules) {
    const key = `${rule.level}::${rule.jurisdiction}`;
    if (!present.has(key)) present.set(key, new Set());
    present.get(key)!.add(rule.category);
    if (!docsByJuris.has(key)) docsByJuris.set(key, new Set());
    if (rule.source_doc_id) docsByJuris.get(key)!.add(rule.source_doc_id);
  }

  const findings: NoRuleFinding[] = [];
  for (const [key, cats] of present) {
    const [level, jurisdiction] = key.split("::") as ["state" | "city", string];
    const linkOnly = LINK_ONLY_CITIES.has(jurisdiction);
    for (const category of CATEGORIES) {
      if (cats.has(category)) continue;
      const label = CATEGORY_LABELS[category];
      const kind: NoRuleKind = linkOnly ? "unverified_link_only" : "no_rule_in_corpus";
      const note = linkOnly
        ? `No captured ${label} rule for ${jurisdiction} in the pack corpus (primary municipal text is link-only / uncaptured). Live applicability stays unknown.`
        : `No extracted ${label} rule for ${jurisdiction} in the current corpus snapshot. This is a corpus gap, not a determination that no law exists.`;
      const note_es = linkOnly
        ? `No hay norma capturada de ${label} para ${jurisdiction} en el corpus del paquete (texto municipal primario solo como enlace / no capturado). La aplicabilidad en vivo permanece desconocida.`
        : `No hay norma extraída de ${label} para ${jurisdiction} en la instantánea actual del corpus. Es un vacío del corpus, no una determinación de que no exista ley.`;
      findings.push({
        finding_id: `nr-${slug(jurisdiction)}-${category}`,
        jurisdiction,
        level,
        category,
        kind,
        note,
        note_es,
        source_doc_ids: [...(docsByJuris.get(key) ?? [])].sort(),
      });
    }
  }

  findings.sort((a, b) =>
    `${a.jurisdiction}:${a.category}`.localeCompare(`${b.jurisdiction}:${b.category}`),
  );

  return {
    generated_at: new Date().toISOString(),
    pipeline_version: PIPELINE_VERSION,
    count: findings.length,
    findings,
  };
}
