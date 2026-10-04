/** Reproducible offline fixtures: only corpus-backed backend responses, no browser legal logic. */
import path from "node:path";
import { DEFAULT_AS_OF } from "@rhl/shared";
import { loadAllAddresses } from "../lib/addresses.js";
import { loadCapturableDocs } from "../lib/corpus.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir, REPO_ROOT } from "../lib/paths.js";
import { evaluateAddress } from "../apply/coverage.js";
import { corpusGapsForGeo } from "../apply/corpus_gaps.js";
import { jurisdictionStack, type GeocodeResult } from "../geocode/census.js";
import { loadRuleVersionsFile, versionsForRule, stableRuleKey } from "../lib/rule_versions.js";
import { loadChangeTests } from "../changes/tracker.js";
import { validateRuleRecord } from "../lib/validate.js";
import { RulesFileSchema } from "@rhl/shared";

const rules = RulesFileSchema.parse(await readJson(path.join(outputsDir(), "rules.json"))).rules;
const docs = await loadCapturableDocs();
for (const rule of rules) {
  const doc = docs.find(d => d.doc_id === rule.source_doc_id);
  if (!doc) throw new Error(`Missing source for ${rule.team_rule_id}`);
  const result = await validateRuleRecord(rule, doc.text);
  if (!result.ok || !doc.text.includes(rule.quoted_span)) throw new Error(`Invalid saved rule ${rule.team_rule_id}`);
}
const history = await loadRuleVersionsFile();
const geos = new Map<string, GeocodeResult>();
for (const filename of ["geocode_cache.json", "stretch_geocode.json"]) {
  const file = await readJson<{ geocoded: GeocodeResult[] }>(path.join(outputsDir(), filename));
  for (const geo of file.geocoded) geos.set(geo.address_id, geo);
}
const addresses = await loadAllAddresses();
const catalog = rules.map(r => ({ ...r, stable_id: stableRuleKey(r), evidence_status: ["HOB-ALG-01", "JC-ALG-01"].includes(r.alias_id ?? "") ? "scenario_only" : "captured", retrieved_at: docs.find(d => d.doc_id === r.source_doc_id)?.retrieved_at ?? null }));
const entries: ReturnType<typeof evaluateAddress> = [];
const indexes = new Map<string, number>();
const snapshots: Record<string, Record<string, number[]>> = {};
for (const asOf of [DEFAULT_AS_OF, "2027-07-02", "2027-10-01"]) {
  snapshots[asOf] = {};
  for (const address of addresses) {
    const geo = geos.get(address.address_id)!;
    snapshots[asOf]![address.address_id] = evaluateAddress({ address, geo, rules, asOf }).map(entry => {
      const key = JSON.stringify(entry);
      let index = indexes.get(key);
      if (index === undefined) { index = entries.length; indexes.set(key, index); entries.push(entry); }
      return index;
    });
  }
}
const properties: Record<string, unknown> = {};
for (const address of addresses) {
  const geo = geos.get(address.address_id)!;
  properties[address.address_id] = { address, jurisdiction: jurisdictionStack(geo), corpus_gaps: await corpusGapsForGeo(geo, rules) };
}
const extracts = Object.fromEntries(docs.filter(d => ["D001", "D069", "D085"].includes(d.doc_id)).map(doc => {
  const extracted = catalog.filter(r => r.source_doc_id === doc.doc_id && r.evidence_status !== "scenario_only");
  return [doc.doc_id, { doc_id: doc.doc_id, source: "saved corpus snapshot", source_url: doc.url, source_text: doc.text, rules: extracted, validation: [{ check: "Saved corpus quotations", passed: extracted.every(r => doc.text.includes(r.quoted_span)), detail: "Saved extraction from the bundled corpus; no live extraction performed." }] }];
}));
await writeJson(path.join(REPO_ROOT, "frontend/src/mocks/snapshots.json"), {
  addresses: addresses.map(a => ({ ...a, legal_city: geos.get(a.address_id)!.legal_city, county: geos.get(a.address_id)!.county })),
  rules: catalog, properties, entries, snapshots,
  changes: { tests: await loadChangeTests(), results: await readJson(path.join(outputsDir(), "changes.json")) },
  versions: Object.fromEntries(rules.map(r => [r.team_rule_id, versionsForRule(history, r)])),
  extracts,
});
console.log(`Wrote corpus-backed offline snapshots for ${addresses.length} addresses.`);
