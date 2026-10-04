/** Generated from the corpus and backend evaluator by npm run demo:snapshots. */
import snapshot from "./snapshots.json";
import type { AddressRow, CatalogRule, ChangesResponse, CorpusDocOption, ExtractResponse, LookupResponse, LookupResult, RuleVersion } from "@/lib/cite/types";

export const MOCK_ADDRESSES = snapshot.addresses as AddressRow[];
export const MOCK_RULES = snapshot.rules as CatalogRule[];
export const MOCK_CHANGES = snapshot.changes as ChangesResponse;
const byRule = new Map(MOCK_RULES.map(r => [r.team_rule_id, r]));
const properties = snapshot.properties as Record<string, Pick<LookupResponse, "address" | "jurisdiction" | "corpus_gaps">>;
const snapshots = snapshot.snapshots as Record<string, Record<string, number[]>>;
const entries = snapshot.entries as Omit<LookupResult, "rule">[];
const extracts = snapshot.extracts as Record<string, ExtractResponse>;
export const MOCK_EXTRACT_DOCS: CorpusDocOption[] = Object.values(extracts).map(d => ({ doc_id: d.doc_id, title: d.rules[0]?.title ?? d.doc_id, jurisdiction: d.rules[0]?.jurisdiction ?? "", source_url: d.source_url }));

export function mockLookup(addressId: string, asOf: string): LookupResponse | null {
  const id = addressId.toUpperCase();
  if (!snapshots[asOf]) throw new Error(`Offline snapshot unavailable for ${asOf}. Available dates: ${Object.keys(snapshots).join(", ")}. Connect the API for other dates.`);
  const property = properties[id];
  const indexes = snapshots[asOf]?.[id];
  if (!property || !indexes) return null;
  return { ...property, as_of: asOf, disclaimer: "Not legal advice and not a compliance certification. Offline corpus snapshot.", results: indexes.map(i => ({ ...entries[i]!, rule: byRule.get(entries[i]!.team_rule_id) ?? null })) };
}
export function mockExtract(docId: string) { return extracts[docId] ?? null; }
export function mockRuleVersions(id: string): RuleVersion[] { return (snapshot.versions as Record<string, RuleVersion[]>)[id] ?? []; }
