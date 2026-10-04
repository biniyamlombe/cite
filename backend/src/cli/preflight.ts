/** Read-only semantic demo checks. No extraction or external delivery. */
import assert from "node:assert/strict";
import { ApiRuleSchema, ChangesResponseSchema, HealthSchema, LookupResponseSchema } from "@rhl/shared";
const base = (process.env.VITE_API_URL || process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
async function get(route: string) {
  const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  return response.json();
}
console.log(`Cite demo preflight: ${base}`);
const health = HealthSchema.parse(await get("/health"));
assert.equal(health.ok, true);
for (const id of ["A0005", "A0065", "A0002", "SA0001"]) {
  const lookup = LookupResponseSchema.parse(await get(`/lookup/${id}?as_of=2026-10-01`));
  assert.ok(lookup.results.length > 0);
  if (id === "A0005") assert.ok(lookup.results.some(r => r.result === "unknown"));
  if (id === "A0065") { assert.equal(lookup.address.postal_city, "Dorchester"); assert.equal(lookup.jurisdiction.city, "Boston"); }
  if (id === "A0002") {
    const hob = lookup.results.find(r => r.rule?.alias_id === "HOB-ALG-01");
    assert.equal(hob?.result, "unknown"); assert.equal(hob?.conflict_flag, true);
    assert.equal(hob?.rule?.source_doc_id, "D069");
    assert.ok((await get(`/rules/${hob!.team_rule_id}/versions`)).versions.length > 0);
  }
  if (id === "SA0001") assert.ok(lookup.results.some(r => r.rule?.jurisdiction.includes("Santa Ana") && r.result === "applies"));
  console.log(`✓ ${id}: ${lookup.results.length} results; expected demo behavior verified`);
}
const changes = ChangesResponseSchema.parse(await get("/changes"));
for (const [id, count] of Object.entries({ T1: 250, T2: 90, T3: 140, T4: 110, T5: 0 })) {
  assert.equal(changes.results[id]?.affected_address_ids.length, count, id);
}
assert.equal(changes.results.T6, undefined, "T6 must be absent (no-hour16 pack)");
assert.equal(changes.results.T3?.conflict_flag_address_ids?.length, 90);
const catalog = await get("/rules");
for (const rule of catalog.rules) ApiRuleSchema.parse(rule);
assert.ok((await get("/corpus/docs")).docs.length > 0);
assert.equal((await fetch(`${base}/lookup/A0003?as_of=2026-99-99`)).status, 400);
console.log("✓ Changes, Rules, Pipeline picker, version history, and invalid-date rejection");
console.log("Preflight passed. Verify keyboard navigation, locale, and About in the UI before presenting.");
