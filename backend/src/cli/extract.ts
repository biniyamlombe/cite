import "dotenv/config";
import path from "node:path";
import { extractAllCorpus, clearDocCache } from "../extract/agent.js";
import { readJsonIfExists, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import type { RuleRecord } from "@rhl/shared";
import { assignAliases } from "../extract/aliases.js";
import { dedupeRules, preferClaudeRules } from "../extract/heuristic.js";
import {
  ensureChangeTestAliases,
  normalizeChangeTestEffectiveDates,
} from "../extract/ensure_aliases.js";
import { appendAudit } from "../lib/audit.js";
import { enrichRuleCoverage } from "../apply/compile_coverage.js";

const FAILED_DEFAULT = ["D016", "D041", "D067", "D073", "D079"];

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const limitArg = argValue("--limit=");
  const limit = limitArg ? Number(limitArg) : undefined;
  const docsArg = argValue("--docs=");
  const retryFailed = process.argv.includes("--retry-failed");
  const merge = process.argv.includes("--merge");

  const docIds = docsArg
    ? docsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : retryFailed
      ? FAILED_DEFAULT
      : undefined;

  if (docIds?.length) {
    for (const id of docIds) {
      const n = await clearDocCache(id);
      console.log(`Cleared cache for ${id}: ${n ? "yes" : "none"}`);
    }
  }

  const {
    rules,
    docsProcessed,
    usedClaude,
    claudeDocsOk,
    claudeDocsFailed,
    claudeRuleCount,
  } = await extractAllCorpus({
    limit,
    docIds,
    clearFailedCache: false,
  });

  const outPath = path.join(outputsDir(), "rules.json");
  let finalRules = rules;

  if (merge && docIds?.length) {
    const existing = await readJsonIfExists<{ rules: RuleRecord[] }>(outPath);
    const kept = (existing?.rules ?? []).filter(
      (r) => !docIds.includes(r.source_doc_id || ""),
    );
    const combined = preferClaudeRules(dedupeRules([...kept, ...rules]));
    const aliased = assignAliases(combined);
    const ensured = assignAliases(
      preferClaudeRules(dedupeRules(await ensureChangeTestAliases(aliased))),
    );
    finalRules = normalizeChangeTestEffectiveDates(ensured).map((r, i) => ({
      ...r,
      team_rule_id: `r-${String(i + 1).padStart(4, "0")}`,
    }));
    console.log(
      `Merged ${rules.length} new rules into ${kept.length} existing → ${finalRules.length} total`,
    );
  }

  finalRules = finalRules.map((r) => enrichRuleCoverage(r));
  await writeJson(outPath, { rules: finalRules });
  const mode = usedClaude
    ? `Claude ok=${claudeDocsOk} failed=${claudeDocsFailed} raw_rules=${claudeRuleCount}`
    : process.env.ANTHROPIC_API_KEY
      ? "Claude failed on all docs; heuristic only"
      : "heuristic only; set ANTHROPIC_API_KEY for Claude";
  await appendAudit({
    ts: new Date().toISOString(),
    kind: "extract_corpus",
    source: usedClaude ? "claude" : "heuristic",
    model: process.env.ANTHROPIC_MODEL || null,
    rule_count: finalRules.length,
    message: mode,
    meta: {
      docs_processed: docsProcessed,
      claude_docs_ok: claudeDocsOk,
      claude_docs_failed: claudeDocsFailed,
      merge: Boolean(merge && docIds?.length),
      doc_ids: docIds ?? null,
    },
  });
  console.log(
    `Wrote ${finalRules.length} rules from ${docsProcessed} docs → ${outPath} (${mode})`,
  );
  const aliases = finalRules.filter((r) => r.alias_id).map((r) => r.alias_id);
  console.log("Change-test aliases:", aliases.join(", ") || "(none)");
  if (docIds?.length) {
    for (const id of docIds) {
      const n = finalRules.filter((r) => r.source_doc_id === id).length;
      console.log(`  ${id}: ${n} rules`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
