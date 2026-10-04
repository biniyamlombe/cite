import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AsOfDateSchema, type RuleRecord } from "@rhl/shared";
import { evaluateAddress } from "../apply/coverage.js";
import { evaluateExecutableCoverage } from "../apply/executable.js";
import { loadAllAddresses } from "../lib/addresses.js";
import { outputsDir } from "../lib/paths.js";
import { readJsonIfExists, writeJson } from "../lib/io.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { GeocodeResult } from "../geocode/census.js";
const rules = JSON.parse(await readFile(path.join(outputsDir(), "rules.json"), "utf8")).rules as RuleRecord[];
const addresses = await loadAllAddresses();
const geos = (await Promise.all(["geocode_cache.json", "stretch_geocode.json"].map(async f => JSON.parse(await readFile(path.join(outputsDir(), f), "utf8")).geocoded))).flat() as GeocodeResult[];
const lookup = (id: string, asOf: string) => evaluateAddress({ address: addresses.find(a => a.address_id === id)!, geo: geos.find(g => g.address_id === id)!, rules, asOf });

test("real dates only, including leap-year boundaries", () => {
  for (const date of ["nonsense", "2026-99-99", "2026-02-29", "2026-04-31"]) {
    assert.equal(AsOfDateSchema.safeParse(date).success, false);
    assert.throws(() => lookup("A0003", date));
  }
  assert.equal(AsOfDateSchema.safeParse("2028-02-29").success, true);
});
test("Santa Ana rolling exemption ages out, boundary stays unknown", () => {
  const id = rules.find(r => r.source_doc_id === "D085" && r.category === "just_cause_eviction" && /last 15 years/i.test(r.exemptions ?? ""))!.team_rule_id;
  assert.equal(lookup("SA0003", "2026-10-01").find(r => r.team_rule_id === id), undefined);
  assert.equal(lookup("SA0003", "2033-10-01").find(r => r.team_rule_id === id)?.result, "unknown");
  assert.equal(lookup("SA0003", "2040-10-01").find(r => r.team_rule_id === id)?.result, "applies");
});
test("unresolved local coverage cannot establish supersession", () => {
  for (const id of ["A0107", "A0432"]) assert.equal(lookup(id, "2026-10-01").find(r => r.team_rule_id === "r-0014")?.result, "unknown");
});
test("municipal scenarios stay unknown with conflict context", () => {
  const id = rules.find(r => r.alias_id === "HOB-ALG-01")!.team_rule_id;
  const result = lookup("A0002", "2026-10-01").find(r => r.team_rule_id === id)!;
  assert.equal(result.result, "unknown"); assert.equal(result.conflict_flag, true);
  assert.match(result.explanation, /uncaptured/);
});
test("all-only executable predicates are enforced and missing facts are unknown", () => {
  const address = addresses.find(a => a.address_id === "A0005")!;
  const geo = geos.find(g => g.address_id === address.address_id)!;
  assert.equal(evaluateExecutableCoverage({ text: "unit requirement", all: [{ field: "units", operator: "gte", value: 5 }] }, address, geo)?.kind, "unknown");
  const base = rules.find(r => r.level === "state" && r.jurisdiction === "CA" && r.status === "in_force")!;
  const rule = { ...base, coverage_conditions: { text: "unit requirement", all: [{ field: "units" as const, operator: "gte" as const, value: 1000 }] } };
  assert.deepEqual(evaluateAddress({ address: { ...address, units: "10" }, geo, rules: [rule] }), []);
});
test("malformed JSON is an error, missing JSON alone is optional", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cite-io-"));
  try {
    const file = path.join(directory, "data.json");
    assert.equal(await readJsonIfExists(file), null);
    await writeJson(file, { ok: true }); assert.deepEqual(await readJsonIfExists(file), { ok: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "{"); await assert.rejects(readJsonIfExists(file));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Hono demo routes return valid results, reject impossible dates, and expose all addresses", async () => {
  const { app } = await import("../api/server.js");
  const { LookupResponseSchema, ChangesResponseSchema, ApiRuleSchema } = await import("@rhl/shared");
  for (const id of ["A0005", "A0065", "A0002", "SA0001"]) {
    const response = await app.request(`/lookup/${id}?as_of=2026-10-01`);
    assert.equal(response.status, 200);
    const result = LookupResponseSchema.parse(await response.json());
    assert.ok(result.results.length > 0);
    if (id === "A0002") assert.equal(result.results.find(r => r.rule?.alias_id === "HOB-ALG-01")?.rule?.evidence_status, "scenario_only");
  }
  assert.equal((await app.request("/lookup/A0003?as_of=2026-99-99")).status, 400);
  const addresses = await (await app.request("/addresses?limit=1000")).json();
  assert.equal(addresses.addresses.length, 506);
  ChangesResponseSchema.parse(await (await app.request("/changes")).json());
  const catalog = await (await app.request("/rules")).json();
  for (const rule of catalog.rules) ApiRuleSchema.parse(rule);
  assert.ok((await (await app.request("/corpus/docs")).json()).docs.length > 0);
});
test("live extraction fallback really validates schema and verbatim source", async () => {
  const { app } = await import("../api/server.js");
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const response = await app.request("/extract/doc/D022", { method: "POST" });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.rules.length > 0);
    assert.ok(body.validation.every((v: { passed: boolean }) => v.passed));
    for (const rule of body.rules) assert.ok(body.source_text.includes(rule.quoted_span));
  } finally { if (key !== undefined) process.env.ANTHROPIC_API_KEY = key; }
});
