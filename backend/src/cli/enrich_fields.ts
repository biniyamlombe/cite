/**
 * Backfill penalty, retrieved_at, exemptions, and effective_date on outputs/rules.json.
 */
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { enrichRuleFields } from "../extract/enrich_fields.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { appendAudit } from "../lib/audit.js";
import { validateRuleRecord } from "../lib/validate.js";
import { loadDocById } from "../lib/corpus.js";

async function main() {
  const outPath = path.join(outputsDir(), "rules.json");
  const file = await readJson<{ rules: RuleRecord[] }>(outPath);
  const { rules, stats } = await enrichRuleFields(file.rules);

  for (const rule of rules) {
    const doc = rule.source_doc_id ? await loadDocById(rule.source_doc_id) : null;
    if (!doc) throw new Error(`Missing corpus document for ${rule.team_rule_id}`);
    const result = await validateRuleRecord(rule, doc.text);
    if (!result.ok) {
      throw new Error(
        `Invalid after enrich ${rule.team_rule_id}: ${result.errors.join("; ")}`,
      );
    }
  }

  await writeJson(outPath, { rules });
  await appendAudit({
    ts: new Date().toISOString(),
    kind: "note",
    message: `Enriched rule fields: retrieved_at=${stats.retrieved_at} penalty=${stats.penalty} exemptions_filled=${stats.exemptions_filled} exemptions_none_stated=${stats.exemptions_none_stated} effective_date=${stats.effective_date}`,
    meta: stats,
  });
  console.log(`Enriched fields → ${outPath}`);
  console.log(
    `  retrieved_at +${stats.retrieved_at}  penalty +${stats.penalty}  exemptions filled +${stats.exemptions_filled}  none-stated +${stats.exemptions_none_stated}  effective_date +${stats.effective_date}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
