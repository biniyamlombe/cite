import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { RuleRecordSchema } from "@rhl/shared";
import {
  loadCapturableDocs,
  loadDocById,
  type CorpusDoc,
} from "../lib/corpus.js";
import { validateRuleRecord } from "../lib/validate.js";
import { cacheDir } from "../lib/paths.js";
import { assignAliases } from "./aliases.js";
import { ensureChangeTestAliases } from "./ensure_aliases.js";
import {
  buildQuoteRetryUserPrompt,
  buildUserPrompt,
  chunkDocBody,
  EXTRACTION_SYSTEM,
  QUOTE_RETRY_SYSTEM,
  RETRY_EXTRACTION_SYSTEM,
} from "./prompt.js";
import { extractRulesPayload } from "./json_repair.js";
import {
  dedupeRules,
  heuristicExtractDoc,
  preferClaudeRules,
} from "./heuristic.js";
import { appendAudit } from "../lib/audit.js";

function nextId(n: number): string {
  return `r-${String(n).padStart(4, "0")}`;
}

function cacheKey(docId: string, body: string): string {
  const h = createHash("sha256").update(body).digest("hex").slice(0, 16);
  return `${docId}-${h}.json`;
}

function cachePath(doc: CorpusDoc): string {
  return path.join(cacheDir(), cacheKey(doc.doc_id, doc.body));
}

async function loadCache(doc: CorpusDoc): Promise<unknown | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(doc), "utf8"));
    // Treat prior parse-failure placeholders as cache misses so we can retry.
    if (
      parsed &&
      typeof parsed === "object" &&
      "_parse_error" in parsed &&
      Array.isArray((parsed as { rules?: unknown[] }).rules) &&
      (parsed as { rules: unknown[] }).rules.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveCache(doc: CorpusDoc, data: unknown): Promise<void> {
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(cachePath(doc), JSON.stringify(data, null, 2), "utf8");
}

export async function clearDocCache(docId: string): Promise<number> {
  const docs = await loadCapturableDocs();
  const doc = docs.find((d) => d.doc_id === docId);
  if (!doc) return 0;
  try {
    await unlink(cachePath(doc));
    return 1;
  } catch {
    return 0;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function callClaudeJson(options: {
  client: Anthropic;
  model: string;
  system: string;
  user: string;
  label: string;
  maxTokens?: number;
}): Promise<string> {
  const msg = await withTimeout(
    options.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: 0,
      system: options.system,
      messages: [{ role: "user", content: options.user }],
    }),
    150_000,
    options.label,
  );
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("\n");
}

function isQuoteFailure(errors: string[]): boolean {
  return errors.some((e) => e.toLowerCase().includes("quoted_span"));
}

function spanPreview(candidate: unknown): string {
  const span =
    typeof candidate === "object" &&
    candidate &&
    "quoted_span" in candidate &&
    typeof (candidate as { quoted_span?: unknown }).quoted_span === "string"
      ? (candidate as { quoted_span: string }).quoted_span
      : "";
  return span.slice(0, 80);
}

async function validateCandidates(
  candidates: unknown[],
  doc: CorpusDoc,
  phase: "initial" | "quote_retry" = "initial",
): Promise<{ kept: RuleRecord[]; quoteFailed: unknown[] }> {
  const kept: RuleRecord[] = [];
  const quoteFailed: unknown[] = [];
  for (const candidate of candidates) {
    const withMeta = {
      ...(typeof candidate === "object" && candidate ? candidate : {}),
      source_doc_id:
        (candidate as { source_doc_id?: string })?.source_doc_id || doc.doc_id,
      source_url:
        (candidate as { source_url?: string })?.source_url || doc.url,
    };
    const result = await validateRuleRecord(withMeta, doc.text);
    if (result.ok) {
      kept.push(result.rule);
      continue;
    }
    const soft = RuleRecordSchema.safeParse(withMeta);
    if (soft.success && soft.data.quoted_span.length >= 20) {
      const v2 = await validateRuleRecord(soft.data, doc.text);
      if (v2.ok) {
        kept.push(v2.rule);
        continue;
      }
      if (isQuoteFailure(v2.errors)) {
        if (phase === "initial") quoteFailed.push(soft.data);
        await appendAudit({
          ts: new Date().toISOString(),
          kind: "quote_rejected",
          doc_id: doc.doc_id,
          message:
            phase === "initial"
              ? "quoted_span not exact in source; queued for Claude quote retry"
              : "quoted_span still not exact after Claude quote retry",
          meta: {
            phase,
            title: soft.data.title,
            span_preview: spanPreview(soft.data),
            errors: v2.errors,
          },
        });
        continue;
      }
      await appendAudit({
        ts: new Date().toISOString(),
        kind: "quote_rejected",
        doc_id: doc.doc_id,
        message: "rule failed validation (non-quote)",
        meta: {
          phase,
          title: soft.data.title,
          span_preview: spanPreview(soft.data),
          errors: v2.errors,
        },
      });
      continue;
    }
    await appendAudit({
      ts: new Date().toISOString(),
      kind: "quote_rejected",
      doc_id: doc.doc_id,
      message: "rule failed schema/shape before citation check",
      meta: {
        phase,
        span_preview: spanPreview(withMeta),
        errors: result.errors,
      },
    });
  }
  return { kept, quoteFailed };
}

async function retryQuotesWithClaude(options: {
  client: Anthropic;
  model: string;
  doc: CorpusDoc;
  failedRules: unknown[];
}): Promise<RuleRecord[]> {
  const { client, model, doc, failedRules } = options;
  if (!failedRules.length) return [];
  const batch = failedRules.slice(0, 6);
  try {
    const text = await callClaudeJson({
      client,
      model,
      system: QUOTE_RETRY_SYSTEM,
      user: buildQuoteRetryUserPrompt({
        doc_id: doc.doc_id,
        body: doc.body,
        failedRules: batch,
      }),
      label: `${doc.doc_id}-quote-retry`,
      maxTokens: 3000,
    });
    const payload = extractRulesPayload(text);
    const { kept, quoteFailed } = await validateCandidates(
      payload.rules,
      doc,
      "quote_retry",
    );
    await appendAudit({
      ts: new Date().toISOString(),
      kind: "quote_retry",
      doc_id: doc.doc_id,
      source: "claude",
      model,
      rule_count: kept.length,
      message: `quote retry recovered ${kept.length}/${batch.length}; still failing ${quoteFailed.length}`,
      meta: {
        attempted: batch.length,
        recovered: kept.length,
        still_failing: quoteFailed.length,
      },
    });
    return kept;
  } catch (err) {
    await appendAudit({
      ts: new Date().toISOString(),
      kind: "quote_retry",
      doc_id: doc.doc_id,
      source: "claude",
      model,
      message: `quote retry failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return [];
  }
}

async function extractChunk(
  client: Anthropic,
  model: string,
  doc: CorpusDoc,
  body: string,
  label: string,
): Promise<{ rules: unknown[]; method: string }> {
  const user = buildUserPrompt({ ...doc, body });
  try {
    const text = await callClaudeJson({
      client,
      model,
      system: EXTRACTION_SYSTEM,
      user,
      label,
    });
    const payload = extractRulesPayload(text);
    return { rules: payload.rules, method: payload.method };
  } catch (err) {
    // Retry with stricter/smaller JSON contract
    const text = await callClaudeJson({
      client,
      model,
      system: RETRY_EXTRACTION_SYSTEM,
      user:
        user +
        "\n\nIMPORTANT: Previous response had invalid JSON. Return compact valid JSON only. Escape all quotes inside strings.",
      label: `${label}-retry`,
      maxTokens: 3000,
    });
    const payload = extractRulesPayload(text);
    return {
      rules: payload.rules,
      method: `retry-${payload.method}`,
    };
  }
}

async function claudeExtractDoc(doc: CorpusDoc): Promise<RuleRecord[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const client = new Anthropic({ apiKey, timeout: 120_000 });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const cached = await loadCache(doc);
  let parsed: unknown = cached;
  if (!parsed) {
    const chunks = chunkDocBody(doc.body);
    const allRules: unknown[] = [];
    const methods: string[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        const label =
          chunks.length === 1
            ? doc.doc_id
            : `${doc.doc_id}#${i + 1}/${chunks.length}`;
        const { rules, method } = await extractChunk(
          client,
          model,
          doc,
          chunks[i]!,
          label,
        );
        allRules.push(...rules);
        methods.push(method);
        process.stdout.write(` [${label}:${method}:${rules.length}]`);
      }
      parsed = {
        rules: allRules,
        _methods: methods,
        _chunks: chunks.length,
      };
    } catch (err) {
      parsed = {
        rules: [],
        _parse_error: err instanceof Error ? err.message : String(err),
      };
    }
    await saveCache(doc, parsed);
  }

  const rulesRaw =
    parsed && typeof parsed === "object" && parsed !== null && "rules" in parsed
      ? (parsed as { rules: unknown[] }).rules
      : [];
  const { kept, quoteFailed } = await validateCandidates(rulesRaw, doc);
  if (!quoteFailed.length) return kept;

  process.stdout.write(` [quote-retry:${quoteFailed.length}]`);
  const recovered = await retryQuotesWithClaude({
    client,
    model,
    doc,
    failedRules: quoteFailed,
  });
  return [...kept, ...recovered];
}

export async function extractDocument(
  docId: string,
): Promise<{ rules: RuleRecord[]; source: "claude" | "heuristic" | "mixed" }> {
  const doc = await loadDocById(docId);
  if (!doc) throw new Error(`Document not found or not capturable: ${docId}`);

  const claudeRules = await claudeExtractDoc(doc);
  const heuristicRules = claudeRules.length ? [] : heuristicExtractDoc(doc);
  let source: "claude" | "heuristic" | "mixed" = "heuristic";
  let merged: RuleRecord[];
  if (claudeRules.length && heuristicRules.length) {
    merged = preferClaudeRules(dedupeRules([...claudeRules, ...heuristicRules]));
    source = "mixed";
  } else if (claudeRules.length) {
    merged = claudeRules;
    source = "claude";
  } else {
    merged = heuristicRules;
    source = "heuristic";
  }
  const withAlias = assignAliases(merged);
  return {
    rules: withAlias.map((r, i) => ({ ...r, team_rule_id: nextId(i + 1) })),
    source,
  };
}

export async function extractAllCorpus(options?: {
  limit?: number;
  docIds?: string[];
  clearFailedCache?: boolean;
}): Promise<{
  rules: RuleRecord[];
  docsProcessed: number;
  usedClaude: boolean;
  claudeDocsOk: number;
  claudeDocsFailed: number;
  claudeRuleCount: number;
}> {
  let docs = await loadCapturableDocs();
  if (options?.docIds?.length) {
    const set = new Set(options.docIds);
    docs = docs.filter((d) => set.has(d.doc_id));
  }
  if (options?.limit) docs = docs.slice(0, options.limit);

  if (options?.clearFailedCache) {
    for (const doc of docs) {
      await clearDocCache(doc.doc_id);
    }
  }

  const keyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
  const all: RuleRecord[] = [];
  let claudeDocsOk = 0;
  let claudeDocsFailed = 0;
  let claudeRuleCount = 0;
  let n = 0;
  for (const doc of docs) {
    n += 1;
    process.stdout.write(`\rExtracting ${n}/${docs.length}: ${doc.doc_id}`);
    let rules: RuleRecord[] = [];
    if (keyPresent) {
      try {
        rules = await claudeExtractDoc(doc);
        if (rules.length === 0) {
          // Distinguish empty-but-successful from failed placeholder.
          const cached = await loadCache(doc);
          const failed =
            cached &&
            typeof cached === "object" &&
            cached !== null &&
            "_parse_error" in cached;
          if (failed) {
            claudeDocsFailed += 1;
            console.warn(`\nClaude produced 0 validated rules for ${doc.doc_id}`);
          } else {
            claudeDocsOk += 1;
          }
        } else {
          claudeDocsOk += 1;
          claudeRuleCount += rules.length;
        }
      } catch (err) {
        claudeDocsFailed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`\nClaude failed for ${doc.doc_id}: ${msg}`);
      }
    }
    const heur = rules.length ? [] : heuristicExtractDoc(doc);
    all.push(...rules, ...heur);
  }
  process.stdout.write("\n");

  const deduped = preferClaudeRules(dedupeRules(all));
  const aliased = assignAliases(deduped);
  const ensured = assignAliases(
    preferClaudeRules(dedupeRules(await ensureChangeTestAliases(aliased))),
  );
  const numbered = ensured.map((r, i) => ({
    ...r,
    team_rule_id: nextId(i + 1),
  }));

  return {
    rules: numbered,
    docsProcessed: docs.length,
    usedClaude: claudeDocsOk > 0,
    claudeDocsOk,
    claudeDocsFailed,
    claudeRuleCount,
  };
}
