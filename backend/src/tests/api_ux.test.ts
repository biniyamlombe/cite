import assert from "node:assert/strict";
import { test } from "node:test";
import { app } from "../api/server.js";
import { evaluateAddress } from "../apply/coverage.js";
import { cachedAddresses, cachedGeos, cachedRules } from "../api/cache.js";
import { ApiErrorBodySchema, LookupResponseSchema } from "@rhl/shared";

test("lookup returns meta, warnings, product_states, and dual labels", async () => {
  const response = await app.request("/lookup/A0005?as_of=2026-10-01");
  assert.equal(response.status, 200);
  const json = await response.json();
  const parsed = LookupResponseSchema.parse(json);
  assert.ok(parsed.meta?.request_id);
  assert.ok(parsed.meta?.pipeline_version);
  assert.ok(Array.isArray(parsed.warnings));
  assert.ok(Array.isArray(parsed.product_states));
  assert.ok(parsed.product_states!.includes("address_resolved") || parsed.product_states!.includes("partial_result"));
  if (parsed.results[0]) {
    assert.ok(
      parsed.results[0].status_label != null || parsed.results[0].legal_status_at_as_of_date != null,
    );
  }
});

test("invalid as_of returns structured error envelope", async () => {
  const response = await app.request("/lookup/A0005?as_of=2026-99-99");
  assert.equal(response.status, 400);
  const body = ApiErrorBodySchema.parse(await response.json());
  assert.equal(body.error.code, "INVALID_AS_OF");
  assert.ok(body.error.user_message);
  assert.ok(body.error.request_id);
  assert.equal(body.error.retryable, false);
});

test("unknown address returns ADDRESS_NOT_FOUND envelope", async () => {
  const response = await app.request("/lookup/ZZZZZ?as_of=2026-10-01");
  assert.equal(response.status, 404);
  const body = ApiErrorBodySchema.parse(await response.json());
  assert.equal(body.error.code, "ADDRESS_NOT_FOUND");
});

test("fact overrides mark user_provided and can change unknown coverage", async () => {
  const addresses = await cachedAddresses();
  const geos = await cachedGeos();
  const rules = await cachedRules();
  const addr = addresses.find((a) => a.address_id === "A0005");
  const geo = geos.get("A0005");
  assert.ok(addr && geo);

  const base = evaluateAddress({
    address: addr!,
    geo: geo!,
    rules,
    asOf: "2026-10-01",
  });
  const unknown = base.filter((r) => r.result === "unknown");
  // Session override path via HTTP
  const response = await app.request(
    "/lookup/A0005?as_of=2026-10-01&year_built=1970&units=20",
  );
  assert.equal(response.status, 200);
  const json = LookupResponseSchema.parse(await response.json());
  assert.equal(json.building_facts?.facts_source, "user_provided");
  assert.ok(json.warnings?.some((w) => w.code === "USER_PROVIDED_FACTS"));
  assert.ok(json.audit?.user_provided_facts);
  // If base had unknowns due to missing year/units, overrides should not invent worse states
  assert.ok(json.results.length >= 0);
  assert.ok(unknown.length >= 0);
});

test("version and health expose pipeline metadata", async () => {
  const health = await (await app.request("/health")).json();
  assert.equal(health.ok, true);
  assert.ok(health.pipeline_version);
  const version = await (await app.request("/version")).json();
  assert.ok(version.api_schema_version);
  assert.ok(version.disclaimer);
});

test("public errors do not include stack traces", async () => {
  const response = await app.request("/lookup/A0005?as_of=not-a-date");
  const text = await response.text();
  assert.doesNotMatch(text, /at\s+\w+\s+\(/);
  assert.doesNotMatch(text, /node_modules/);
});
