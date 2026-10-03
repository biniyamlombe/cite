/**
 * Attach dual coverage_conditions ({ text, all, unknown_if, omit_if }) to rules.json.
 */
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { asCoverageObject } from "@rhl/shared";
import { enrichRuleCoverage } from "../apply/compile_coverage.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { appendAudit } from "../lib/audit.js";

async function main() {
  const outPath = path.join(outputsDir(), "rules.json");
  const file = await readJson<{ rules: RuleRecord[] }>(outPath);
  let dual = 0;
  const rules = file.rules.map((r) => {
    const enriched = enrichRuleCoverage(r);
    if (asCoverageObject(enriched.coverage_conditions)) dual += 1;
    return enriched;
  });
  await writeJson(outPath, { rules });
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
