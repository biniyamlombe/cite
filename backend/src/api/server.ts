import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "node:path";
import { DEFAULT_AS_OF, type RuleRecord } from "@rhl/shared";
import { loadAddresses } from "../lib/addresses.js";
import { loadCapturableDocs, loadDocById } from "../lib/corpus.js";
import { readJsonIfExists } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import { jurisdictionStack } from "../geocode/census.js";
import { evaluateAddress } from "../apply/coverage.js";
import { extractDocument } from "../extract/agent.js";
import { loadChangeTests } from "../changes/tracker.js";
import { appendAudit, readAuditLog } from "../lib/audit.js";

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(
  "*",
  cors({
    origin: corsOrigin.split(",").map((s) => s.trim()),
  }),
);

async function loadRules(): Promise<RuleRecord[]> {
  const file = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  return file?.rules ?? [];
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
  return { ...rule, retrieved_at } as never;
}

async function loadGeos(): Promise<Map<string, GeocodeResult>> {
  const file = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  return new Map((file?.geocoded ?? []).map((g) => [g.address_id, g]));
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "rental-housing-law-navigator-api",
    as_of_default: process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
    disclaimer: "Not legal advice",
  }),
);

app.get("/addresses", async (c) => {
  const q = (c.req.query("q") || "").toLowerCase().trim();
  const addresses = await loadAddresses();
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
  const limit = Math.min(Number(c.req.query("limit") || 50), 500);
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
  const addresses = await loadAddresses();
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

  return c.json({
    disclaimer: "Not legal advice",
    as_of: asOf,
    address: addr,
    jurisdiction: jurisdictionStack(geo),
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

app.post("/extract/doc/:docId", async (c) => {
  const docId = c.req.param("docId").toUpperCase();
  try {
    const { rules, source } = await extractDocument(docId);
    const doc = await loadDocById(docId);
    const retrieved_at = doc?.retrieved_at ?? null;
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
      disclaimer: "Not legal advice",
      doc_id: docId,
      source,
      retrieved_at,
      count: rules.length,
      rules: rules.map((r) => ({ ...r, retrieved_at })),
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
    disclaimer: "Not legal advice",
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

const port = Number(process.env.PORT || 4000);
console.log(`API listening on http://localhost:${port}`);
console.log("Disclaimer: Not legal advice");
serve({ fetch: app.fetch, port });
