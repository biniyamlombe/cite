import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { evaluateAddress } from "../apply/coverage.js";
import { loadAllAddresses } from "../lib/addresses.js";
import { loadDocById } from "../lib/corpus.js";
import { outputsDir } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import {
  dateStatedInSource,
  deriveActEffectiveDate,
  groundEffectiveDate,
} from "../extract/effective_dates.js";
import { mergeSameBillDuplicates } from "../extract/ensure_aliases.js";
import { runChangesFromDisk } from "../changes/tracker.js";

const rules = JSON.parse(await readFile(path.join(outputsDir(), "rules.json"), "utf8")).rules as RuleRecord[];
const addresses = await loadAllAddresses();
const geos = JSON.parse(await readFile(path.join(outputsDir(), "geocode_cache.json"), "utf8")).geocoded as GeocodeResult[];
const lookup = (id: string, asOf: string) =>
  evaluateAddress({ address: addresses.find((a) => a.address_id === id)!, geo: geos.find((g) => g.address_id === id)!, rules, asOf });

async function body(docId: string): Promise<{ body: string; url: string }> {
  const doc = await loadDocById(docId);
  assert.ok(doc, `${docId} must be capturable`);
  return { body: doc.body, url: doc.url };
}

test("act-level effective dates are derived from enactment text", async () => {
  const cases: Array<[string, string]> = [
    ["D069", "2027-07-01"], // FAIR Act: twelfth month after July 20, 2026
    ["D065", "2022-01-01"], // seventh month after June 18, 2021
    ["D066", "2026-05-01"], // fourth month after January 20, 2026
    ["D022", "2026-01-01"], // CA non-urgency statute approved October 6, 2025
  ];
  for (const [id, expected] of cases) {
    const { body: text, url } = await body(id);
    assert.equal(deriveActEffectiveDate(text, url)?.effective_date, expected, id);
  }
});

test("a model-proposed date absent from the source is replaced, not trusted", async () => {
  const { body: text } = await body("D069");
  const fair = rules.find((r) => r.alias_id === "NJ-ALG-01")!;
  const g = groundEffectiveDate({ ...fair, effective_date: "2026-12-01" }, text);
  assert.equal(g.effective_date, "2027-07-01");
  assert.equal(g.kind, "derived");
});

test("every dated rule in rules.json is grounded in its source", async () => {
  for (const r of rules) {
    if (!r.effective_date) continue;
    const basis = r.effective_date_basis ?? "";
    assert.match(basis, /^(stated|derived|rule_of_law):/, `${r.team_rule_id} basis=${basis}`);
    if (basis.startsWith("stated")) {
      const { body: text } = await body(r.source_doc_id!);
      assert.ok(dateStatedInSource(r.effective_date, text), `${r.team_rule_id} ${r.effective_date} not in ${r.source_doc_id}`);
    }
  }
});

test("NJ FAIR Act has exactly one statewide record and it is the extracted provision", () => {
  const fair = rules.filter((r) => r.source_doc_id === "D069" && r.level === "state");
  assert.equal(fair.length, 1);
  assert.equal(fair[0]!.alias_id, "NJ-ALG-01");
  assert.notEqual(fair[0]!.extraction_method, "corpus_anchor");
});

test("no NJ algorithmic rule applies before the FAIR Act effective date", () => {
  for (const asOf of ["2026-10-01", "2026-12-02", "2027-06-30"]) {
    const alg = lookup("A0003", asOf).filter((e) => {
      const r = rules.find((x) => x.team_rule_id === e.team_rule_id)!;
      return r.category === "algorithmic_rent_setting" && r.level === "state";
    });
    assert.ok(alg.length > 0);
    for (const e of alg) assert.notEqual(e.result, "applies", `${e.team_rule_id} applies on ${asOf}`);
  }
  const after = lookup("A0003", "2027-07-02").find((e) => rules.find((x) => x.team_rule_id === e.team_rule_id)?.alias_id === "NJ-ALG-01")!;
  assert.equal(after.result, "applies");
  assert.equal(after.legal_status_at_as_of_date, "in_force", "status must follow the as-of date");
});

test("municipal algorithmic bans use adopted ordinance PDFs, not FAIR quotes", () => {
  const expect: Record<string, { doc: string; date: string }> = {
    "HOB-ALG-01": { doc: "HOB-ORD-01", date: "2025-07-09" },
    "JC-ALG-01": { doc: "JC-ORD-01", date: "2025-05-21" },
  };
  for (const [alias, exp] of Object.entries(expect)) {
    const r = rules.find((x) => x.alias_id === alias)!;
    assert.equal(r.extraction_method, "municipal_ordinance");
    assert.equal(r.source_doc_id, exp.doc);
    assert.equal(r.effective_date, exp.date);
    assert.doesNotMatch(r.quoted_span, /municipality shall be prohibited/i);
    assert.match(r.quoted_span, /algorithm|unlawful|prohibited/i);
  }
  const hob = lookup("A0002", "2026-10-01").find((e) => rules.find((x) => x.team_rule_id === e.team_rule_id)?.alias_id === "HOB-ALG-01")!;
  assert.equal(hob.result, "applies");
  assert.equal(hob.legal_status_at_as_of_date, "in_force");
  const newark = lookup("A0003", "2026-10-01").find((e) => rules.find((x) => x.team_rule_id === e.team_rule_id)?.alias_id === "HOB-ALG-01");
  assert.equal(newark, undefined, "Hoboken ordinance must not attach to Newark");
});

test("T2 membership uses live municipal ordinance applies, not scaffolds", async () => {
  const geoMap = new Map(geos.map((g) => [g.address_id, g]));
  const changes = await runChangesFromDisk({ rules, geos: geoMap });
  assert.equal(changes.T2!.affected_address_ids.length, 90);
  assert.match(changes.T2!.notes ?? "", /HOB-ORD-01 \/ JC-ORD-01/);
  assert.doesNotMatch(changes.T2!.notes ?? "", /Scenario membership only/);
  assert.match(changes.T2!.evidence_summary ?? "", /hob_method=municipal_ordinance/);
  assert.match(changes.T2!.evidence_summary ?? "", /jc_method=municipal_ordinance/);
});

test("T5 treats the c.40P prohibition as no rent cap", async () => {
  const geoMap = new Map(geos.map((g) => [g.address_id, g]));
  const changes = await runChangesFromDisk({ rules, geos: geoMap });
  assert.equal(changes.T5!.affected_address_ids.length, 0);
  assert.doesNotMatch(changes.T5!.notes ?? "", /WARNING/);
});

test("a pending bill captured from two pack pages is published once", () => {
  const s2983 = rules.filter((r) => r.jurisdiction === "MA" && /\bS\.?\s?2983\b/.test(r.citation));
  assert.equal(s2983.length, 1);
  assert.equal(s2983[0]!.alias_id, "MA-ALG-P1");
  const { alias_id: _alias, ...rest } = s2983[0]!;
  const copy: RuleRecord = { ...rest, team_rule_id: "r-dup", citation: "S.2983 (194th Legislature)" };
  assert.deepEqual(mergeSameBillDuplicates([s2983[0]!, copy]).map((r) => r.team_rule_id), [s2983[0]!.team_rule_id]);
});
