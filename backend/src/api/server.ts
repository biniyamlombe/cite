import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AsOfDateSchema, DEFAULT_AS_OF, RulesFileSchema, type RuleRecord } from "@rhl/shared";
import { loadAllAddresses } from "../lib/addresses.js";
import { exactSpanInSource, loadCapturableDocs, loadDocById } from "../lib/corpus.js";
import { readJsonIfExists } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import { jurisdictionStack } from "../geocode/census.js";
import { evaluateAddress } from "../apply/coverage.js";
import { corpusGapsForGeo } from "../apply/corpus_gaps.js";
import { extractDocument } from "../extract/agent.js";
import { loadChangeTests } from "../changes/tracker.js";
import { appendAudit, readAuditLog } from "../lib/audit.js";
import {
  loadRuleVersionsFile,
  recordCurrentRuleVersions,
  versionsForRule,
  stableRuleKey,
} from "../lib/rule_versions.js";
import { renderConsolePage } from "./consolePage.js";

export const app = new Hono();

const corsAllow = (
  process.env.CORS_ORIGIN ||
  [
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:5173",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (corsAllow.includes("*") || corsAllow.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    // Lovable cloud previews
    return (
      host === "lovable.app" ||
      host.endsWith(".lovable.app") ||
      host === "lovableproject.com" ||
      host.endsWith(".lovableproject.com")
    );
  } catch {
    return false;
  }
}

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return corsAllow[0] ?? "*";
      return isAllowedOrigin(origin) ? origin : corsAllow[0] ?? "";
    },
  }),
);

async function loadRules(): Promise<RuleRecord[]> {
  const file = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  return file ? RulesFileSchema.parse(file).rules : [];
}

/** Map source_doc_id → corpus retrieval timestamp (from file headers / manifest). */
async function loadRetrievedAtByDocId(): Promise<Map<string, string>> {
  const docs = await loadCapturableDocs();
  return new Map(
    docs
      .filter((d) => Boolean(d.retrieved_at))
      .map((d) => [d.doc_id, d.retrieved_at]),
  );
}

function withRetrievedAt<T extends RuleRecord | null>(
  rule: T,
  retrievedAtByDoc: Map<string, string>,
): T extends null
  ? null
  : T & { retrieved_at: string | null } {
  if (!rule) return null as never;
  const retrieved_at =
    (rule.source_doc_id && retrievedAtByDoc.get(rule.source_doc_id)) || null;
  return { ...rule, retrieved_at, stable_id: stableRuleKey(rule), evidence_status: ["HOB-ALG-01", "JC-ALG-01"].includes(rule.alias_id ?? "") ? "scenario_only" : "captured" } as never;
}

async function loadGeos(): Promise<Map<string, GeocodeResult>> {
  const pack = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  const stretch = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "stretch_geocode.json"),
  );
  return new Map(
    [...(pack?.geocoded ?? []), ...(stretch?.geocoded ?? [])].map((g) => [
      g.address_id,
      g,
    ]),
  );
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "cite-api",

    as_of_default: process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
    disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
  }),
);

/** Operator console — YC-facing API landing (HTML). JSON clients use /health. */
app.get("/", async (c) => {
  const accept = c.req.header("accept") || "";
  if (accept.includes("application/json") && !accept.includes("text/html")) {
    return c.json({
      ok: true,
      service: "cite-api",
      docs: "Open / in a browser for the operator console",
      health: "/health",
      disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
    });
  }

  const [rules, addresses, changeTests] = await Promise.all([
    loadRules(),
    loadAllAddresses(),
    loadChangeTests().catch(() => [] as Awaited<ReturnType<typeof loadChangeTests>>),
  ]);
  const aliases = new Set(
    rules.map((r) => r.alias_id).filter((a): a is string => Boolean(a)),
  );
  // Pack T1–T5 (+ optional T6 in outputs/changes.json for the demo story)
  let changeCount = changeTests.length;
  try {
    const out = await readJsonIfExists<Record<string, unknown>>(
      path.join(outputsDir(), "changes.json"),
    );
    if (out) changeCount = Math.max(changeCount, Object.keys(out).length);
  } catch {
    /* keep pack count */
  }
  const html = renderConsolePage({
    ok: true,
    asOf: process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
    rules: rules.length,
    addresses: addresses.length,
    changes: changeCount,
    aliases: aliases.size,
    port: Number(process.env.PORT || 4000),
  });
  return c.html(html);
});

app.get("/addresses", async (c) => {
  const q = (c.req.query("q") || "").toLowerCase().trim();
  const addresses = await loadAllAddresses();
  const geos = await loadGeos();
  let rows = addresses;
  if (q) {
    rows = addresses.filter(
      (a) =>
        a.address_id.toLowerCase().includes(q) ||
        a.street_address.toLowerCase().includes(q) ||
        a.postal_city.toLowerCase().includes(q) ||
        (geos.get(a.address_id)?.legal_city || "").toLowerCase().includes(q),
    );
  }
  const limit = Math.min(Math.max(1, Number(c.req.query("limit") || 50) || 50), 1000);
  return c.json({
    count: rows.length,
    addresses: rows.slice(0, limit).map((a) => {
      const g = geos.get(a.address_id);
      return {
        ...a,
        legal_city: g?.legal_city ?? null,
        county: g?.county ?? null,
      };
    }),
  });
});

app.get("/lookup/:addressId", async (c) => {
  const addressId = c.req.param("addressId");
  const asOf = c.req.query("as_of") || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;
  if (!AsOfDateSchema.safeParse(asOf).success) return c.json({ error: "Invalid as_of: use a real calendar date (YYYY-MM-DD)." }, 400);
  const addresses = await loadAllAddresses();
  const addr = addresses.find((a) => a.address_id === addressId);
  if (!addr) return c.json({ error: "Address not found" }, 404);

  const geos = await loadGeos();
  const geo = geos.get(addressId);
  if (!geo) {
    return c.json(
      {
        error: "Address not geocoded yet. Run npm run geocode.",
        address: addr,
      },
      409,
    );
  }

  const rules = await loadRules();
  if (!rules.length) {
    return c.json(
      { error: "No rules loaded. Run npm run extract." },
      409,
    );
  }

  const entries = evaluateAddress({ address: addr, geo, rules, asOf });
  const byId = new Map(rules.map((r) => [r.team_rule_id, r]));
  const retrievedAtByDoc = await loadRetrievedAtByDocId();
  const corpus_gaps = await corpusGapsForGeo(geo, rules);

  return c.json({
    disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
    as_of: asOf,
    address: addr,
    jurisdiction: jurisdictionStack(geo),
    corpus_gaps,
    results: entries.map((e) => ({
      ...e,
      rule: withRetrievedAt(byId.get(e.team_rule_id) ?? null, retrievedAtByDoc),
    })),
  });
});

app.get("/rules", async (c) => {
  const rules = await loadRules();
  const category = c.req.query("category");
  const filtered = category
    ? rules.filter((r) => r.category === category)
    : rules;
  const retrievedAtByDoc = await loadRetrievedAtByDocId();
  return c.json({
    count: filtered.length,
    rules: filtered.map((r) => withRetrievedAt(r, retrievedAtByDoc)),
  });
});

app.get("/changes", async (c) => {
  const file = await readJsonIfExists<Record<string, unknown>>(
    path.join(outputsDir(), "changes.json"),
  );
  const tests = await loadChangeTests();
  return c.json({ tests, results: file ?? {} });
});

app.get("/changes/:testId", async (c) => {
  const testId = c.req.param("testId").toUpperCase();
  const file = await readJsonIfExists<Record<string, unknown>>(
    path.join(outputsDir(), "changes.json"),
  );
  const tests = await loadChangeTests();
  const test = tests.find((t) => t.test_id === testId);
  const result = file?.[testId];
  if (!test && !result) return c.json({ error: "Unknown test" }, 404);
  return c.json({ test, result: result ?? null });
});

app.get("/rules/:teamRuleId/versions", async (c) => {
  const teamRuleId = c.req.param("teamRuleId");
  const rules = await loadRules();
  const rule = rules.find((r) => r.team_rule_id === teamRuleId);
  if (!rule) return c.json({ error: "Unknown rule", versions: [] }, 404);
  let file = await loadRuleVersionsFile();
  // Lazy seed: if history file missing/empty, record current tip so UI is never blank.
  if (!Object.keys(file.by_key).length) {
    file = await recordCurrentRuleVersions(rules);
  }
  return c.json({ versions: versionsForRule(file, rule) });
});

/** Capturable corpus docs for the live Pipeline picker (Module A). */
app.get("/corpus/docs", async (c) => {
  const docs = await loadCapturableDocs();
  const list = docs
    .map((d) => {
      const firstLine =
        d.body
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l.length > 12) || d.doc_id;
      const title =
        firstLine.length > 90 ? `${firstLine.slice(0, 87)}…` : firstLine;
      return {
        doc_id: d.doc_id,
        title,
        jurisdiction: d.jurisdictions.join("; ") || "—",
        source_url: d.url,
        retrieved_at: d.retrieved_at,
        chars: d.body.length,
      };
    })
    .sort((a, b) => a.doc_id.localeCompare(b.doc_id));
  return c.json({
    disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
    count: list.length,
    docs: list,
  });
});

app.post("/extract/doc/:docId", async (c) => {
  const docId = c.req.param("docId").toUpperCase();
  try {
    const { rules, source } = await extractDocument(docId);
    const doc = await loadDocById(docId);
    const retrieved_at = doc?.retrieved_at ?? null;
    const source_url = doc?.url ?? "";
    // Cap response payload; verify spans against the full corpus document.
    const source_text = (doc?.body || doc?.text || "").slice(0, 12_000);
    const withMeta = rules.map((r) => ({ ...r, retrieved_at }));
    const spanOk = withMeta.every(
      (r) => Boolean(doc) && exactSpanInSource(r.quoted_span, doc!.text),
    );
    await appendAudit({
      ts: new Date().toISOString(),
      kind: "extract_doc",
      doc_id: docId,
      source,
      model: process.env.ANTHROPIC_MODEL || null,
      rule_count: rules.length,
      rule_ids: rules.map((r) => r.team_rule_id),
      message: `Live extract ${docId} via ${source}`,
    });
    return c.json({
      disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
      doc_id: docId,
      source,
      source_url,
      source_text,
      retrieved_at,
      count: rules.length,
      rules: withMeta,
      validation: [
        {
          check: "Schema + Zod/Ajv",
          passed: true,
          detail: `${withMeta.length} rule(s) validated before return`,
        },
        {
          check: "Verbatim quoted span in corpus",
          passed: spanOk,
          detail: spanOk
            ? `${withMeta.length} returned span(s) matched the full corpus document exactly`
            : "One or more quotations do not match the corpus",
        },
        {
          check: "Source document loaded",
          passed: Boolean(doc),
          detail: doc
            ? `${docId} loaded (${source_text.length} chars shown)`
            : `${docId} missing from corpus`,
        },
      ],
    });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      400,
    );
  }
});

app.get("/audit", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 40), 200);
  const events = await readAuditLog(limit);
  return c.json({
    disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
    count: events.length,
    events,
  });
});

app.get("/submission/:file", async (c) => {
  const file = c.req.param("file");
  const allowed = new Set([
    "rules.json",
    "lookups.json",
    "changes.json",
    "geocode_cache.json",
  ]);
  if (!allowed.has(file)) return c.json({ error: "Not allowed" }, 400);
  const data = await readJsonIfExists(path.join(outputsDir(), file));
  if (!data) return c.json({ error: "File not generated yet" }, 404);
  return c.json(data);
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  serve({ fetch: app.fetch, port });
  console.log(`API listening on http://localhost:${port}`);
  console.log("Disclaimer: Not legal advice and not a compliance certification");
}
