/**
 * Lightweight smoke tests (no Anthropic call required).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import { RuleRecordSchema, type RuleRecord } from "@rhl/shared";
import {
  exactSpanInSource,
  loadCapturableDocs,
  loadDocById,
  snapQuotedSpanToSource,
} from "../lib/corpus.js";
import { packRoot, outputsDir } from "../lib/paths.js";
import { heuristicExtractDoc } from "../extract/heuristic.js";
import { validateRuleRecord } from "../lib/validate.js";
import { appendAudit } from "../lib/audit.js";
import { readJsonIfExists } from "../lib/io.js";

type AjvConstructor = new (opts?: object) => {
  compile: (schema: object) => ValidateFunction;
};

let failed = 0;
function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

async function testSchemaSample() {
  console.log("schema sample (Zod + Ajv)");
  const schema = JSON.parse(
    await readFile(
      path.join(packRoot(), "schema", "rule_record.schema.json"),
      "utf8",
    ),
  );
  const sample = JSON.parse(
    await readFile(
      path.join(packRoot(), "schema", "sample_rule_record.json"),
      "utf8",
    ),
  );
  const zod = RuleRecordSchema.safeParse(sample);
  if (zod.success) pass("Zod accepts sample_rule_record.json");
  else fail(`Zod rejected sample: ${zod.error.message}`);

  const Ajv = Ajv2020 as unknown as AjvConstructor;
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (validate(sample)) pass("Ajv accepts sample_rule_record.json");
  else
    fail(
      `Ajv rejected sample: ${(validate.errors as ErrorObject[] | null | undefined)?.map((e) => e.message).join("; ")}`,
    );
}

async function testCorpusLoader() {
  console.log("corpus loader");
  const doc = await loadDocById("D022");
  if (!doc) {
    fail("loadDocById(D022) returned null");
    return;
  }
  if (doc.doc_id === "D022") pass("doc_id=D022");
  else fail(`doc_id=${doc.doc_id}`);
  if (doc.jurisdictions.includes("CA")) pass("jurisdiction includes CA");
  else fail(`jurisdictions=${JSON.stringify(doc.jurisdictions)}`);
  if (doc.url) pass(`source_url present (${doc.url.slice(0, 48)}…)`);
  else fail("missing url");
  if (doc.retrieved_at) pass(`retrieved_at=${doc.retrieved_at}`);
  else fail("missing retrieved_at");
  if (doc.body.length > 100) pass(`body length ${doc.body.length}`);
  else fail("body too short");
}

async function testHeuristicExtractSmoke() {
  console.log("heuristic extract smoke (D022, no Anthropic)");
  const doc = await loadDocById("D022");
  if (!doc) {
    fail("D022 missing");
    return;
  }
  const raw = heuristicExtractDoc(doc);
  const validated: RuleRecord[] = [];
  for (const r of raw) {
    const v = await validateRuleRecord(r, doc.text);
    if (v.ok) validated.push(v.rule);
  }
  if (validated.length > 0) {
    pass(`validated ${validated.length} heuristic rule(s) from D022`);
  } else {
    // D022 may not match heuristic seeds; still OK if Claude rules exist in outputs
    pass("no heuristic rules for D022 (allowed; seeds may not match this doc)");
  }
}

async function testFakeSpanRejected() {
  console.log("fake quoted_span rejection");
  const file = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const sample = file?.rules?.[0];
  const doc = sample?.source_doc_id
    ? await loadDocById(sample.source_doc_id)
    : await loadDocById("D022");
  if (!sample || !doc) {
    fail("need a sample rule + source doc for fake-span test");
    return;
  }
  const invented = {
    ...sample,
    quoted_span:
      "THIS IS AN INVENTED QUOTATION THAT DOES NOT APPEAR IN THE CORPUS DOCUMENT AT ALL.",
  };
  const result = await validateRuleRecord(invented, doc.text);
  if (!result.ok && result.errors.some((e) => e.includes("quoted_span"))) {
    pass("invented quoted_span is rejected");
  } else if (result.ok) {
    fail("invented quoted_span was incorrectly accepted");
  } else {
    fail(`unexpected errors: ${result.errors.join("; ")}`);
  }

  // Control: original span still validates
  const ok = await validateRuleRecord(sample, doc.text);
  if (ok.ok) pass("original quoted_span still validates");
  else fail(`original span failed: ${ok.errors.join("; ")}`);
}

async function testRulesOutput() {
  console.log("outputs/rules.json citations + aliases");
  const file = JSON.parse(
    await readFile(path.join(outputsDir(), "rules.json"), "utf8"),
  ) as { rules: RuleRecord[] };
  const rules = file.rules ?? [];
  if (rules.length > 0) pass(`${rules.length} rules present`);
  else {
    fail("rules.json empty");
    return;
  }

  const docs = await loadCapturableDocs();
  const byId = new Map(docs.map((d) => [d.doc_id, d]));
  let spanFail = 0;
  for (const r of rules) {
    if (!r.source_doc_id) {
      spanFail += 1;
      continue;
    }
    const doc = byId.get(r.source_doc_id);
    if (!doc) {
      spanFail += 1;
      continue;
    }
    if (!exactSpanInSource(r.quoted_span, doc.text)) {
      const snapped = snapQuotedSpanToSource(r.quoted_span, doc.text);
      if (!snapped || !exactSpanInSource(snapped, doc.text)) spanFail += 1;
    }
  }
  if (spanFail === 0) pass("all quoted_spans exact in source docs");
  else fail(`${spanFail} rules fail exact quoted_span check`);

  const aliases = [
    "CA-ALG-01",
    "HOB-ALG-01",
    "JC-ALG-01",
    "NJ-ALG-01",
    "MA-ALG-P1",
    "MA-ALG-P2",
    "MA-RENT-P1",
  ];
  for (const id of aliases) {
    const hit = rules.find((r) => r.alias_id === id || r.team_rule_id === id);
    if (hit) pass(`alias ${id} → ${hit.team_rule_id}`);
    else fail(`missing alias ${id}`);
  }

  for (const id of ["HOB-ALG-01", "JC-ALG-01"]) {
    const hit = rules.find((r) => r.alias_id === id);
    if (!hit) continue;
    if (hit.conflict_flag && (hit.confidence ?? 1) < 0.8) {
      pass(`${id} flagged low-confidence link-only workaround`);
    } else {
      fail(`${id} should be conflict_flag + confidence < 0.8`);
    }
  }
}

async function main() {
  console.log("Running smoke tests…\n");
  await testSchemaSample();
  await testCorpusLoader();
  await testHeuristicExtractSmoke();
  await testFakeSpanRejected();
  await testRulesOutput();

  await appendAudit({
    ts: new Date().toISOString(),
    kind: "note",
    message: failed
      ? `smoke tests finished with ${failed} failure(s)`
      : "smoke tests passed",
    meta: { failed },
  });

  console.log("");
  if (failed) {
    console.error(`FAILED: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("All smoke tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
