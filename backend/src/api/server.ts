import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_SCHEMA_VERSION,
  ARTIFACT_SCHEMA_VERSION,
  AsOfDateSchema,
  BuildingFactOverridesSchema,
  DEFAULT_AS_OF,
  PIPELINE_VERSION,
  type PlainLanguageFile,
  type RuleRecord,
  type SupportedLocale,
} from "@rhl/shared";
import { headlineForLookup } from "../plain/headlines.js";
import { checkRentIncrease } from "../check/rent.js";
import { answerQuestion } from "../ask/ground.js";
import { rentIncreaseLetter } from "../letter/templates.js";
import { z } from "zod";
import {
  displayApplicabilityLabel,
  displayStatusLabel,
  localizeExplanation,
  localizeWarnings,
  localizedDisclaimer,
  localizedErrorUserMessage,
  resolveRequestLocale,
  sourceEvidenceBlock,
} from "./locale.js";
import { parseOptionalInt } from "../lib/addresses.js";
import { exactSpanInSource, loadCapturableDocs, loadDocById } from "../lib/corpus.js";
import { readJsonIfExists } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
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
import {
  apiError,
  buildMeta,
  deriveProductStates,
  deriveWarnings,
  newRequestId,
} from "./envelope.js";
import {
  cachedAddresses,
  cachedGeos,
  cachedRetrievedAtByDocId,
  cachedRules,
} from "./cache.js";

export const app = new Hono();
const DISCLAIMER = localizedDisclaimer("en-US");

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
      host.endsWith(".lovableproject.com") ||
      host === "vercel.app" ||
      host.endsWith(".vercel.app") ||
      host === "onrender.com" ||
      host.endsWith(".onrender.com")
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

let plainLanguageCache: PlainLanguageFile | null | undefined;

async function loadPlainLanguage(): Promise<PlainLanguageFile | null> {
  if (plainLanguageCache !== undefined) return plainLanguageCache;
  plainLanguageCache =
    (await readJsonIfExists<PlainLanguageFile>(
      path.join(outputsDir(), "plain_language.json"),
    )) ?? null;
  return plainLanguageCache;
}

async function loadRules(): Promise<RuleRecord[]> {
  return cachedRules();
}

/** Map source_doc_id → corpus retrieval timestamp (from file headers / manifest). */
async function loadRetrievedAtByDocId(): Promise<Map<string, string>> {
  return cachedRetrievedAtByDocId();
}

function withRetrievedAt<T extends RuleRecord | null>(
  rule: T,
  retrievedAtByDoc: Map<string, string>,
): T extends null
  ? null
  : T & { retrieved_at: string | null } {
  if (!rule) return null as never;
  const retrieved_at =
    rule.retrieved_at ||
    (rule.source_doc_id && retrievedAtByDoc.get(rule.source_doc_id)) ||
    null;
  const method = (rule as { extraction_method?: string | null }).extraction_method;
  const scenarioOnly =
    method === "link_only_scaffold" || method === "secondary_report";
  return {
    ...rule,
    retrieved_at,
    stable_id: stableRuleKey(rule),
    evidence_status: scenarioOnly ? "scenario_only" : "captured",
  } as never;
}

async function loadGeos() {
  return cachedGeos();
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "cite-api",
    as_of_default: process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
    disclaimer: DISCLAIMER,
    pipeline_version: PIPELINE_VERSION,
    schema_version: API_SCHEMA_VERSION,
  }),
);

app.get("/version", (c) =>
  c.json({
    service: "cite-api",
    pipeline_version: PIPELINE_VERSION,
    schema_version: ARTIFACT_SCHEMA_VERSION,
    api_schema_version: API_SCHEMA_VERSION,
    as_of_default: process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
    disclaimer: DISCLAIMER,
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
    cachedAddresses(),
    loadChangeTests().catch(() => [] as Awaited<ReturnType<typeof loadChangeTests>>),
  ]);
  const aliases = new Set(
    rules.map((r) => r.alias_id).filter((a): a is string => Boolean(a)),
  );
  // Pack T1–T5 only (participant-final-no-hour16; T6 removed)
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
  const requestId = newRequestId();
  const q = (c.req.query("q") || "").toLowerCase().trim();
  const addresses = await cachedAddresses();
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
  const meta = buildMeta({ requestId });
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
    meta,
    warnings:
      q && rows.length === 0
        ? [
            {
              code: "PARTIAL_RESULT" as const,
              message: "No pack addresses matched the query.",
              user_message:
                "No matching properties in the supported demo set. Try a sample ID (e.g. A0005) or a street from the pack cities.",
            },
          ]
        : [],
  });
});

function normalizeOverrides(raw: {
  year_built?: string | number | undefined;
  units?: string | number | undefined;
}): { year_built?: string; units?: string; used: boolean; override_fields: string[] } {
  const parsed = BuildingFactOverridesSchema.safeParse(raw);
  if (!parsed.success) return { used: false, override_fields: [] };
  const override_fields: string[] = [];
  const out: { year_built?: string; units?: string; used: boolean; override_fields: string[] } = {
    used: false,
    override_fields,
  };
  if (parsed.data.year_built != null && String(parsed.data.year_built).trim() !== "") {
    out.year_built = String(parsed.data.year_built).trim();
    override_fields.push("year_built");
    out.used = true;
  }
  if (parsed.data.units != null && String(parsed.data.units).trim() !== "") {
    out.units = String(parsed.data.units).trim();
    override_fields.push("units");
    out.used = true;
  }
  return out;
}

async function handleLookup(
  c: Parameters<typeof apiError>[0],
  opts: {
    addressId: string;
    asOf: string;
    includeNonApplicable: boolean;
    year_built?: string | number;
    units?: string | number;
    locale?: SupportedLocale;
    locale_warning?: string | null;
  },
) {
  const requestId = newRequestId();
  const locale = opts.locale ?? "en-US";
  const asOf = opts.asOf || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;
  if (!AsOfDateSchema.safeParse(asOf).success) {
    return apiError(
      c,
      400,
      "INVALID_AS_OF",
      "Invalid as_of: use a real calendar date (YYYY-MM-DD).",
      localizedErrorUserMessage(
        "INVALID_AS_OF",
        "Enter a valid calendar date in YYYY-MM-DD format.",
        locale,
      ),
      { field_errors: { as_of: "Invalid calendar date" }, requestId },
    );
  }
  const includeNonApplicable = opts.includeNonApplicable;
  const overrides = normalizeOverrides({
    year_built: opts.year_built,
    units: opts.units,
  });
  const addresses = await cachedAddresses();
  const addr = addresses.find((a) => a.address_id === opts.addressId);
  if (!addr) {
    return apiError(
      c,
      404,
      "ADDRESS_NOT_FOUND",
      "Address not found in the supported demo set.",
      localizedErrorUserMessage(
        "ADDRESS_NOT_FOUND",
        "That address is not in the supported sample set. Try a demo ID such as A0005, or search by street in a covered city.",
        locale,
      ),
      { requestId },
    );
  }

  const geos = await loadGeos();
  const geo = geos.get(opts.addressId);
  if (!geo) {
    return apiError(
      c,
      409,
      "NOT_GEOCODED",
      "Address not geocoded yet. Run npm run geocode.",
      localizedErrorUserMessage(
        "NOT_GEOCODED",
        "Jurisdiction for this address is not ready yet. Retry after geocoding completes.",
        locale,
      ),
      { retryable: true, requestId, extra: { address: addr } },
    );
  }

  const rules = await loadRules();
  if (!rules.length) {
    return apiError(
      c,
      409,
      "NO_RULES_LOADED",
      "No rules loaded. Run npm run extract.",
      localizedErrorUserMessage(
        "NO_RULES_LOADED",
        "Rule data is not loaded. Retry shortly or contact the operator.",
        locale,
      ),
      { retryable: true, requestId },
    );
  }

  const effectiveAddr = {
    ...addr,
    ...(overrides.year_built != null ? { year_built: overrides.year_built } : {}),
    ...(overrides.units != null ? { units: overrides.units } : {}),
  };

  const entries = evaluateAddress({
    address: addr,
    geo,
    rules,
    asOf,
    includeNonApplicable,
    addressOverrides: overrides.used
      ? { year_built: overrides.year_built, units: overrides.units }
      : undefined,
  });
  const byId = new Map(rules.map((r) => [r.team_rule_id, r]));
  const retrievedAtByDoc = await loadRetrievedAtByDocId();
  const plainFile = await loadPlainLanguage();
  const corpus_gaps = await corpusGapsForGeo(geo, rules);
  const stack = jurisdictionStack(geo);
  const generated_at = new Date().toISOString();
  const results = entries.map((e) => {
    const rule = withRetrievedAt(byId.get(e.team_rule_id) ?? null, retrievedAtByDoc);
    const statusCode = e.legal_status_at_as_of_date ?? rule?.status ?? null;
    const applicabilityCode = e.applicability ?? e.result;
    const localized = localizeExplanation({
      explanation: e.explanation,
      locale,
      conflictFlag: e.conflict_flag,
    });
    const headline = headlineForLookup({
      record: plainFile?.records?.[e.team_rule_id],
      result: e.result,
      locale,
      factsMissing: e.facts_missing,
      statusAtAsOf: e.legal_status_at_as_of_date ?? null,
    });
    return {
      ...e,
      // Keep English explanation as authoritative corpus text; Spanish goes in plain_language_summary.
      explanation: e.explanation,
      status_label: displayStatusLabel(statusCode, locale) ?? statusCode,
      applicability_label:
        displayApplicabilityLabel(applicabilityCode, locale) ?? applicabilityCode,
      headline,
      plain_language_summary: localized.plain_language_summary,
      source_evidence: sourceEvidenceBlock(rule, locale),
      translation: localized.translation,
      rule,
    };
  });
  const resultLikes = results.map((r) => {
    const evidence =
      r.rule && "evidence_status" in r.rule
        ? (r.rule as { evidence_status?: string | null }).evidence_status ?? null
        : null;
    return {
      result: r.result,
      conflict_flag: r.conflict_flag,
      needs_human_review: r.needs_human_review,
      facts_missing: r.facts_missing,
      rule: r.rule ? { evidence_status: evidence } : null,
    };
  });
  const product_states = deriveProductStates({
    jurisdictionTrusted: Boolean(stack.trusted),
    jurisdictionStatus: stack.status,
    results: resultLikes,
    corpusGaps: corpus_gaps,
    userProvidedFacts: overrides.used,
  });
  const warnings = localizeWarnings(
    deriveWarnings({
      jurisdictionTrusted: Boolean(stack.trusted),
      jurisdictionResolution: stack.resolution,
      results: resultLikes,
      corpusGaps: corpus_gaps,
      userProvidedFacts: overrides.used,
    }),
    locale,
  );
  const meta = buildMeta({ requestId, asOf, generatedAt: generated_at });

  return c.json({
    disclaimer: localizedDisclaimer(locale),
    as_of: asOf,
    locale,
    locale_warning: opts.locale_warning ?? null,
    address: effectiveAddr,
    jurisdiction: stack,
    building_facts: {
      year_built: parseOptionalInt(effectiveAddr.year_built),
      unit_count: parseOptionalInt(effectiveAddr.units),
      property_type: null,
      occupancy_type: null,
      use_code: addr.use_code || null,
      facts_source: overrides.used
        ? "user_provided"
        : addr.source_dataset || "sample_addresses.csv",
      override_fields: overrides.override_fields,
    },
    audit: {
      pipeline_version: PIPELINE_VERSION,
      generated_at,
      include_non_applicable: includeNonApplicable,
      request_id: requestId,
      user_provided_facts: overrides.used,
    },
    meta,
    warnings,
    product_states,
    corpus_gaps,
    results,
  });
}

function localeFromRequest(
  c: Parameters<typeof apiError>[0],
  bodyLocale?: unknown,
): { locale: SupportedLocale; locale_warning: string | null } {
  const raw =
    (typeof bodyLocale === "string" ? bodyLocale : undefined) ||
    c.req.query("locale") ||
    c.req.header("accept-language") ||
    undefined;
  return resolveRequestLocale(raw);
}

app.get("/lookup/:addressId", async (c) => {
  const { locale, locale_warning } = localeFromRequest(c);
  return handleLookup(c, {
    addressId: c.req.param("addressId"),
    asOf: c.req.query("as_of") || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF,
    includeNonApplicable:
      c.req.query("include_non_applicable") === "1" ||
      c.req.query("include_non_applicable") === "true",
    year_built: c.req.query("year_built") || undefined,
    units: c.req.query("units") || undefined,
    locale,
    locale_warning,
  });
});

app.post("/lookup/:addressId", async (c) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const facts = BuildingFactOverridesSchema.safeParse(body.building_facts ?? body);
  const { locale, locale_warning } = localeFromRequest(c, body.locale);
  return handleLookup(c, {
    addressId: c.req.param("addressId"),
    asOf:
      (typeof body.as_of === "string" ? body.as_of : undefined) ||
      c.req.query("as_of") ||
      process.env.AS_OF_DEFAULT ||
      DEFAULT_AS_OF,
    includeNonApplicable:
      body.include_non_applicable === true ||
      body.include_non_applicable === "1" ||
      c.req.query("include_non_applicable") === "1",
    year_built: facts.success ? facts.data.year_built : undefined,
    units: facts.success ? facts.data.units : undefined,
    locale,
    locale_warning,
  });
});

const RentCheckBodySchema = z.object({
  address_id: z.string().min(1),
  as_of: AsOfDateSchema.optional(),
  current_rent: z.number().positive(),
  new_rent: z.number().positive(),
  locale: z.string().optional(),
});

app.post("/ask", async (c) => {
  const requestId = newRequestId();
  const bodySchema = z.object({
    address_id: z.string().min(1),
    as_of: AsOfDateSchema.optional(),
    question: z.string().min(3).max(500),
    locale: z.string().optional(),
  });
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid JSON", "Request body must be JSON.", {
      requestId,
    });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "VALIDATION_ERROR",
      "Invalid ask request",
      "Provide address_id and question.",
      { requestId },
    );
  }
  const { locale } = localeFromRequest(c, parsed.data.locale);
  const asOf = parsed.data.as_of || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;
  const addresses = await cachedAddresses();
  const addr = addresses.find((a) => a.address_id === parsed.data.address_id);
  if (!addr) {
    return apiError(c, 404, "ADDRESS_NOT_FOUND", "Address not found", "Address not found.", {
      requestId,
    });
  }
  const geos = await loadGeos();
  const geo = geos.get(addr.address_id);
  if (!geo) {
    return apiError(c, 409, "NOT_GEOCODED", "Not geocoded", "Address not geocoded yet.", {
      retryable: true,
      requestId,
    });
  }
  const rules = await loadRules();
  const entries = evaluateAddress({
    address: addr,
    geo,
    rules,
    asOf,
    includeNonApplicable: true,
  });
  const plain = await loadPlainLanguage();
  const headlines = Object.fromEntries(
    Object.entries(plain?.records ?? {}).map(([id, r]) => [
      id,
      { headline_en: r.headline_en, headline_es: r.headline_es },
    ]),
  );
  const answer = answerQuestion({
    question: parsed.data.question,
    entries,
    rulesById: new Map(rules.map((r) => [r.team_rule_id, r])),
    headlines,
  });
  await appendAudit({
    ts: new Date().toISOString(),
    kind: "note",
    message: "ask",
    meta: {
      address_id: addr.address_id,
      refused: answer.refused,
      citations: answer.citations.length,
    },
  });
  return c.json({
    disclaimer: localizedDisclaimer(locale),
    as_of: asOf,
    locale,
    address_id: addr.address_id,
    question: parsed.data.question,
    answer: locale === "es-US" ? answer.answer_es : answer.answer,
    refused: answer.refused,
    refusal_reason: answer.refusal_reason ?? null,
    citations: answer.citations,
    meta: buildMeta({ requestId, asOf }),
  });
});

app.post("/letter", async (c) => {
  const requestId = newRequestId();
  const bodySchema = z.object({
    address_id: z.string().min(1),
    as_of: AsOfDateSchema.optional(),
    current_rent: z.number().positive(),
    new_rent: z.number().positive(),
    locale: z.string().optional(),
  });
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid JSON", "Request body must be JSON.", {
      requestId,
    });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "VALIDATION_ERROR",
      "Invalid letter request",
      "Provide address_id, current_rent, and new_rent.",
      { requestId },
    );
  }
  const { locale } = localeFromRequest(c, parsed.data.locale);
  const asOf = parsed.data.as_of || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;
  const addresses = await cachedAddresses();
  const addr = addresses.find((a) => a.address_id === parsed.data.address_id);
  if (!addr) {
    return apiError(c, 404, "ADDRESS_NOT_FOUND", "Address not found", "Address not found.", {
      requestId,
    });
  }
  const geos = await loadGeos();
  const geo = geos.get(addr.address_id);
  if (!geo) {
    return apiError(c, 409, "NOT_GEOCODED", "Not geocoded", "Address not geocoded yet.", {
      retryable: true,
      requestId,
    });
  }
  const rules = await loadRules();
  const entries = evaluateAddress({
    address: addr,
    geo,
    rules,
    asOf,
    includeNonApplicable: false,
  });
  const verdict = checkRentIncrease({
    currentRent: parsed.data.current_rent,
    newRent: parsed.data.new_rent,
    entries,
    rulesById: new Map(rules.map((r) => [r.team_rule_id, r])),
  });
  const quote = verdict.deciding_quotes[0];
  const text = rentIncreaseLetter({
    addressLine: `${addr.street_address}, ${addr.postal_city}, ${addr.state} ${addr.zip}`,
    asOf,
    currentRent: parsed.data.current_rent,
    newRent: parsed.data.new_rent,
    increasePct: verdict.values.increase_pct,
    capPct: verdict.values.cap_pct,
    overAmount: verdict.values.over_amount,
    citation: quote?.citation,
    quote: quote?.quoted_span,
    locale,
  });
  return c.json({
    disclaimer: localizedDisclaimer(locale),
    as_of: asOf,
    address_id: addr.address_id,
    text,
    verdict_kind: verdict.kind,
    meta: buildMeta({ requestId, asOf }),
  });
});

app.post("/check", async (c) => {
  const requestId = newRequestId();
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid JSON body", "Request body must be JSON.", {
      requestId,
    });
  }
  const parsed = RentCheckBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      c,
      400,
      "VALIDATION_ERROR",
      "Invalid rent check request",
      "Provide address_id, current_rent, and new_rent.",
      { requestId, field_errors: { body: "invalid" } },
    );
  }
  const { locale } = localeFromRequest(c, parsed.data.locale);
  const asOf = parsed.data.as_of || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;
  const addresses = await cachedAddresses();
  const addr = addresses.find((a) => a.address_id === parsed.data.address_id);
  if (!addr) {
    return apiError(
      c,
      404,
      "ADDRESS_NOT_FOUND",
      "Address not found",
      localizedErrorUserMessage(
        "ADDRESS_NOT_FOUND",
        "That address is not in the supported sample set.",
        locale,
      ),
      { requestId },
    );
  }
  const geos = await loadGeos();
  const geo = geos.get(addr.address_id);
  if (!geo) {
    return apiError(
      c,
      409,
      "NOT_GEOCODED",
      "Address not geocoded",
      localizedErrorUserMessage(
        "NOT_GEOCODED",
        "Jurisdiction for this address is not ready yet.",
        locale,
      ),
      { retryable: true, requestId },
    );
  }
  const rules = await loadRules();
  const entries = evaluateAddress({
    address: addr,
    geo,
    rules,
    asOf,
    includeNonApplicable: false,
  });
  const verdict = checkRentIncrease({
    currentRent: parsed.data.current_rent,
    newRent: parsed.data.new_rent,
    entries,
    rulesById: new Map(rules.map((r) => [r.team_rule_id, r])),
  });
  return c.json({
    disclaimer: localizedDisclaimer(locale),
    as_of: asOf,
    locale,
    address_id: addr.address_id,
    verdict,
    meta: buildMeta({ requestId, asOf }),
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
  if (!test && !result) {
    return apiError(c, 404, "UNKNOWN_TEST", "Unknown test", "That change scenario was not found.");
  }
  return c.json({ test, result: result ?? null, meta: buildMeta({ requestId: newRequestId() }) });
});

app.get("/rules/:teamRuleId/versions", async (c) => {
  const teamRuleId = c.req.param("teamRuleId");
  const rules = await loadRules();
  const rule = rules.find((r) => r.team_rule_id === teamRuleId);
  if (!rule) {
    return apiError(c, 404, "UNKNOWN_RULE", "Unknown rule", "That rule was not found.", {
      extra: { versions: [] },
    });
  }
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
          check: "Schema validation",
          passed: true,
          detail: `${withMeta.length} rule(s) passed validation`,
        },
        {
          check: "Quotation matches source",
          passed: spanOk,
          detail: spanOk
            ? `${withMeta.length} quotation(s) found in the source document`
            : "One or more quotations do not match the source document",
        },
        {
          check: "Source document loaded",
          passed: Boolean(doc),
          detail: doc ? `${docId} loaded` : `${docId} missing from corpus`,
        },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extract failed";
    return apiError(
      c,
      400,
      "EXTRACT_FAILED",
      message,
      "Document extraction could not be completed. Try another corpus document or retry shortly.",
      { retryable: true },
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

app.get("/no-rule-findings", async (c) => {
  const data = await readJsonIfExists<{
    generated_at?: string;
    count?: number;
    findings?: unknown[];
  }>(path.join(outputsDir(), "no_rule_findings.json"));
  if (!data) {
    return c.json({
      disclaimer: DISCLAIMER,
      count: 0,
      findings: [],
      generated_at: null,
    });
  }
  return c.json({
    disclaimer: DISCLAIMER,
    count: data.count ?? data.findings?.length ?? 0,
    findings: data.findings ?? [],
    generated_at: data.generated_at ?? null,
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
  if (!allowed.has(file)) {
    return apiError(c, 400, "NOT_ALLOWED", "Not allowed", "That submission file is not available.");
  }
  const data = await readJsonIfExists(path.join(outputsDir(), file));
  if (!data) {
    return apiError(
      c,
      404,
      "FILE_MISSING",
      "File not generated yet",
      "That artifact has not been generated yet.",
      { retryable: true },
    );
  }
  return c.json(data);
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  serve({ fetch: app.fetch, port });
  console.log(`API listening on http://localhost:${port}`);
  console.log("Disclaimer: Not legal advice and not a compliance certification");
}
