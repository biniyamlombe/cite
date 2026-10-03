/**
 * One-shot: heuristic-extract unused capturable docs into rules.json.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { loadCapturableDocs } from "../lib/corpus.js";
import { heuristicExtractDoc } from "../extract/heuristic.js";
import { validateRuleRecord } from "../lib/validate.js";
import { outputsDir } from "../lib/paths.js";

async function main() {
  const rulesPath = path.join(outputsDir(), "rules.json");
  const data = JSON.parse(await readFile(rulesPath, "utf8")) as {
    rules: RuleRecord[];
  };
  const haveDocs = new Set(
    data.rules.map((r) => r.source_doc_id).filter(Boolean),
  );
  const haveAliases = new Set(
    data.rules.map((r) => r.alias_id).filter(Boolean),
  );
  const docs = await loadCapturableDocs();
  const unused = docs.filter((d) => !haveDocs.has(d.doc_id));
  console.log(
    "unused capturable:",
    unused.map((d) => d.doc_id).join(", ") || "(none)",
  );

  let next = data.rules.length + 1;
  const added: RuleRecord[] = [];
  for (const doc of unused) {
    for (const r of heuristicExtractDoc(doc)) {
      if (r.alias_id && haveAliases.has(r.alias_id)) continue;
      const soft = [r.category, r.jurisdiction.toLowerCase(), r.level].join(
        "|",
      );
      const softHit = data.rules.find(
        (x) =>
          [x.category, x.jurisdiction.toLowerCase(), x.level].join("|") ===
          soft,
      );
      if (
        softHit &&
        softHit.citation.replace(/\s+/g, " ").toLowerCase() ===
          r.citation.replace(/\s+/g, " ").toLowerCase()
      ) {
        continue;
      }
      const id = `r-${String(next++).padStart(4, "0")}`;
      const candidate = { ...r, team_rule_id: id };
      const v = await validateRuleRecord(candidate, doc.body);
      if (!v.ok) {
        console.warn(
          `skip invalid ${doc.doc_id} (${r.title.slice(0, 40)}):`,
          v.errors.slice(0, 3).join("; "),
        );
        continue;
      }
      const rule = { ...v.rule, team_rule_id: id, alias_id: r.alias_id };
      added.push(rule);
      data.rules.push(rule);
      haveDocs.add(doc.doc_id);
      if (r.alias_id) haveAliases.add(r.alias_id);
    }
  }

  await writeFile(
    rulesPath,
    JSON.stringify({ rules: data.rules }, null, 2) + "\n",
  );
  console.log(`added ${added.length} rules; total ${data.rules.length}`);
  for (const a of added) {
    console.log(
      ` + ${a.team_rule_id} ${a.source_doc_id} ${a.title.slice(0, 70)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
