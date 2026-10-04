import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { buildNoRuleFindings } from "../plain/no_rule_findings.js";

async function main() {
  const rulesFile = await readJson<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const file = buildNoRuleFindings(rulesFile.rules ?? []);
  const outPath = path.join(outputsDir(), "no_rule_findings.json");
  await writeJson(outPath, file);
  console.log(`Wrote ${file.count} no-rule findings → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
