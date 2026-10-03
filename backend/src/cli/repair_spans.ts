/**
 * Rewrite quoted_span values in outputs/rules.json to exact corpus substrings.
 */
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { loadCapturableDocs, snapQuotedSpanToSource } from "../lib/corpus.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";

async function main() {
  const outPath = path.join(outputsDir(), "rules.json");
  const payload = await readJson<{ rules: RuleRecord[] }>(outPath);
  const docs = await loadCapturableDocs();
  const byId = new Map(docs.map((d) => [d.doc_id, d]));

  let exactAlready = 0;
  let snapped = 0;
  let failed: string[] = [];

  const rules = payload.rules.map((rule) => {
    const doc = rule.source_doc_id ? byId.get(rule.source_doc_id) : undefined;
    const source = doc?.text ?? "";
    if (source && source.includes(rule.quoted_span)) {
      exactAlready += 1;
      return rule;
    }
    const exact = source ? snapQuotedSpanToSource(rule.quoted_span, source) : null;
    if (exact && source.includes(exact)) {
      snapped += 1;
      return { ...rule, quoted_span: exact };
    }
    // Last resort: search all capturable docs
    for (const d of docs) {
      const hit = snapQuotedSpanToSource(rule.quoted_span, d.text);
      if (hit && d.text.includes(hit)) {
        snapped += 1;
        return {
          ...rule,
          quoted_span: hit,
          source_doc_id: rule.source_doc_id || d.doc_id,
        };
      }
    }
    failed.push(rule.team_rule_id);
    return rule;
  });

  await writeJson(outPath, { rules });
  console.log(
    `Repaired spans → ${outPath}\n` +
      `  already_exact=${exactAlready} snapped=${snapped} failed=${failed.length}`,
  );
  if (failed.length) {
    console.log("Failed ids:", failed.join(", "));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
