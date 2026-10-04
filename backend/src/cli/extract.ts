import "dotenv/config";
import path from "node:path";
import {
  extractAllCorpus,
  validatedCacheFor,
  clearDocCache,
  retryModel,
} from "../extract/agent.js";
import { readJsonIfExists, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { validateRuleRecord } from "../lib/validate.js";
import { loadCapturableDocs, loadDocById } from "../lib/corpus.js";
import type { RuleRecord } from "@rhl/shared";
import { assignAliases } from "../extract/aliases.js";
import { dedupeRules } from "../extract/heuristic.js";
import { ensureChangeTestAliases } from "../extract/ensure_aliases.js";
import { groundRuleEffectiveDates } from "../extract/effective_dates.js";
import { appendAudit } from "../lib/audit.js";
import { enrichRuleCoverage } from "../apply/compile_coverage.js";
import { enrichRuleFields } from "../extract/enrich_fields.js";

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/** Capturable docs with no rules in outputs/rules.json (or empty on disk). */
async function discoverUncoveredDocIds(): Promise<string[]> {
  const docs = await loadCapturableDocs();
  const existing = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const covered = new Set(
    (existing?.rules ?? [])
      .map((r) => r.source_doc_id)
      .filter((id): id is string => Boolean(id)),
  );
  return docs.map((d) => d.doc_id).filter((id) => !covered.has(id));
}

async function main() {
  const limitArg = argValue("--limit=");
  const limit = limitArg ? Number(limitArg) : undefined;
  const docsArg = argValue("--docs=");
  const retryFailed = process.argv.includes("--retry-failed");
  const mergeFlag = process.argv.includes("--merge");
  const noUpgrade = process.argv.includes("--no-upgrade-empty");
  const modelOverride = argValue("--model=");

  let docIds = docsArg
    ? docsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  if (retryFailed && !docIds?.length) {
    docIds = await discoverUncoveredDocIds();
    if (!docIds.length) {
      console.log("No uncovered capturable docs — nothing to retry.");
      return;
    }
    console.log(
      `--retry-failed: ${docIds.length} uncovered doc(s) → ${docIds.join(", ")}`,
    );
  }

  // Subset extracts always merge into existing rules.json (unless --no-merge).
  const merge =
    Boolean(docIds?.length) &&
    (mergeFlag || retryFailed || !process.argv.includes("--no-merge"));

  const useRetryModel = Boolean(retryFailed || docIds?.length);
  const model =
    modelOverride ||
    (useRetryModel ? retryModel() : undefined);
  if (model) {
    console.log(`Using model: ${model}${useRetryModel && !modelOverride ? " (retry/empty default)" : ""}`);
  }

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
    upgradedDocIds,
  } = await extractAllCorpus({
    limit,
    docIds,
    clearFailedCache: false,
    model,
    // Subset/retry already uses Sonnet as primary — skip a second upgrade hop.
    upgradeEmptyWith: noUpgrade || useRetryModel ? false : undefined,
  });

  const outPath = path.join(outputsDir(), "rules.json");
  let finalRules = rules;

  if (merge && docIds?.length) {
    const existing = await readJsonIfExists<{ rules: RuleRecord[] }>(outPath);
    const kept = (existing?.rules ?? []).filter(
      (r) => !docIds.includes(r.source_doc_id || ""),
    );
    // `rules` is already preferClaude+dedupe'd for the extracted subset.
    // Do not preferClaude / soft-dedupe the combined set — that drops prior
    // mid-confidence heuristic rows that still cover unique source docs.
    const combined = dedupeRules([...kept, ...rules], { soft: false });
    const aliased = assignAliases(combined);
    const ensured = assignAliases(
      dedupeRules(await ensureChangeTestAliases(aliased), { soft: false }),
    );
    // Alias / ensure passes can erase a newly extracted source doc (e.g. D047 vs
    // D046 both claiming MA-ALG-P1). Re-attach one best rule per extracted doc.
    const haveDocs = new Set(
      ensured.map((r) => r.source_doc_id).filter(Boolean),
    );
    const candidates: RuleRecord[] = [
      ...rules.filter((r) => docIds.includes(r.source_doc_id || "")),
    ];
    for (const id of docIds) {
      if (haveDocs.has(id) || candidates.some((r) => r.source_doc_id === id)) {
        continue;
      }
      candidates.push(...(await validatedCacheFor(id, model)));
    }
    for (const r of [...candidates].sort(
      (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
    )) {
      if (!r.source_doc_id || haveDocs.has(r.source_doc_id)) continue;
      if (!docIds.includes(r.source_doc_id)) continue;
      const { alias_id: _drop, ...rest } = r;
      ensured.push({
        ...(rest as RuleRecord),
        source_doc_id: r.source_doc_id,
      });
      haveDocs.add(r.source_doc_id);
    }
    finalRules = (await groundRuleEffectiveDates(ensured)).map((r, i) => ({
      ...r,
      team_rule_id: `r-${String(i + 1).padStart(4, "0")}`,
    }));
    console.log(
      `Merged ${rules.length} new rules into ${kept.length} existing → ${finalRules.length} total`,
    );
  }

  finalRules = finalRules.map((r) => enrichRuleCoverage(r));
  const enriched = await enrichRuleFields(finalRules);
  finalRules = enriched.rules;
  for (const rule of finalRules) {
    const doc = rule.source_doc_id ? await loadDocById(rule.source_doc_id) : null;
    if (!doc) throw new Error(`Missing corpus document for ${rule.team_rule_id}`);
    const result = await validateRuleRecord(rule, doc.text);
    if (!result.ok) throw new Error(`Invalid output ${rule.team_rule_id}: ${result.errors.join("; ")}`);
  }
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
    model: model || process.env.ANTHROPIC_MODEL || null,
    rule_count: finalRules.length,
    message: mode,
    meta: {
      docs_processed: docsProcessed,
      claude_docs_ok: claudeDocsOk,
      claude_docs_failed: claudeDocsFailed,
      merge,
      doc_ids: docIds ?? null,
      retry_failed: retryFailed,
      upgraded_docs: upgradedDocIds,
      retry_model: retryModel(),
    },
  });
  console.log(
    `Wrote ${finalRules.length} rules from ${docsProcessed} docs → ${outPath} (${mode})`,
  );
  if (upgradedDocIds.length) {
    console.log(
      `Empty-cache Sonnet upgrades: ${upgradedDocIds.join(", ")}`,
    );
  }
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
