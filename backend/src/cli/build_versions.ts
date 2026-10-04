/**
 * Build outputs/rule_versions.json from git history of rules.json + current tip.
 */
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { readJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { buildVersionsFromGit } from "../lib/rule_versions.js";
import { appendAudit } from "../lib/audit.js";

async function main() {
  const rulesPath = path.join(outputsDir(), "rules.json");
  const { rules } = await readJson<{ rules: RuleRecord[] }>(rulesPath);
  const file = await buildVersionsFromGit(rules);
  const keys = Object.keys(file.by_key);
  const multi = keys.filter((k) => (file.by_key[k]?.length || 0) > 1).length;
  await appendAudit({
    ts: new Date().toISOString(),
    kind: "note",
    message: `Built rule version history for ${keys.length} keys (${multi} with >1 version)`,
    meta: { keys: keys.length, multi },
  });
  console.log(
    `Wrote rule versions for ${keys.length} keys (${multi} with history) → ${path.join(outputsDir(), "rule_versions.json")}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
