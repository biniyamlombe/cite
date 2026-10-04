/**
 * Attach dual coverage_conditions ({ text, all, unknown_if, omit_if }) to rules.json.
 * Also refreshes HOB/JC municipal + soft-gap honesty metadata (no re-extract needed).
 */
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { asCoverageObject } from "@rhl/shared";
import { enrichRuleCoverage } from "../apply/compile_coverage.js";
import { ensureChangeTestAliases } from "../extract/ensure_aliases.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { appendAudit } from "../lib/audit.js";
import { recordCurrentRuleVersions } from "../lib/rule_versions.js";

async function main() {
  const outPath = path.join(outputsDir(), "rules.json");
  const file = await readJson<{ rules: RuleRecord[] }>(outPath);
  const ensured = await ensureChangeTestAliases(file.rules);
  let dual = 0;
  const rules = ensured.map((r) => {
    const enriched = enrichRuleCoverage(r);
    if (asCoverageObject(enriched.coverage_conditions)) dual += 1;
    return enriched;
  });
  await writeJson(outPath, { rules });
  await recordCurrentRuleVersions(rules);
  await appendAudit({
    ts: new Date().toISOString(),
    kind: "note",
    message: `Enriched coverage_conditions dual form on ${dual}/${rules.length} rules`,
    meta: { dual, total: rules.length },
  });
  console.log(
    `Enriched ${dual}/${rules.length} rules with dual coverage_conditions → ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
