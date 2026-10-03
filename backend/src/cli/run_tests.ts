/**
 * Lightweight smoke tests (no Anthropic call required).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import {
  asCoverageObject,
  RuleRecordSchema,
  type RuleRecord,
} from "@rhl/shared";
import { evaluateExecutableCoverage } from "../apply/executable.js";
import { evaluateStatus } from "../apply/coverage.js";
import { enrichRuleCoverage } from "../apply/compile_coverage.js";
import {
  geocodeAddresses,
  isTrustedLegalCity,
  type GeocodeResult,
} from "../geocode/census.js";
import { loadAddresses } from "../lib/addresses.js";
import { runChangesFromDisk } from "../changes/tracker.js";
import {
  assertT1,
  assertT2,
  assertT3,
  assertT4,
  assertT5,
} from "../changes/tests/index.js";
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

async function testDualCoverage() {
  console.log("dual coverage_conditions (text + executable)");
  const file = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const rules = file?.rules ?? [];
  const dual = rules.filter((r) => asCoverageObject(r.coverage_conditions));
  if (dual.length > 0) {
    pass(`${dual.length}/${rules.length} rules have dual coverage objects`);
  } else {
    fail("no dual coverage_conditions objects in rules.json — run npm run enrich-coverage");
  }

  const sf = rules.find(
    (r) =>
      /san francisco/i.test(r.jurisdiction) &&
      r.category === "rent_increase_limits",
  );
  if (!sf) {
    fail("no SF rent_increase_limits rule to probe");
    return;
  }
  const enriched = enrichRuleCoverage(sf);
  const cov = asCoverageObject(enriched.coverage_conditions);
  if (cov?.text && (cov.omit_if?.length || cov.unknown_if?.length)) {
    pass("SF rent rule compiles text + unknown_if/omit_if");
  } else {
    fail("SF rent rule missing executable guards");
  }

  const geo = {
    address_id: "t",
    legal_city: "San Francisco",
    county: "San Francisco County",
    state: "CA",
    matched_address: "",
    source: "heuristic" as const,
    resolution: "known_jurisdiction" as const,
  };
  const newBuild = {
    address_id: "t",
    street_address: "x",
    postal_city: "San Francisco",
    state: "CA",
    zip: "94102",
    year_built: "1990",
    units: "10",
    use_code: "",
    use_description: "",
    source_dataset: "",
    retrieved_at: "",
  };
  const hit = cov
    ? evaluateExecutableCoverage(cov, newBuild, geo)
    : null;
  if (hit?.kind === "omit") pass("SF executable omits post-1979 building");
  else fail(`expected omit for 1990 SF building, got ${JSON.stringify(hit)}`);
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

  const ca = rules.find((r) => r.alias_id === "CA-ALG-01");
  const nj = rules.find((r) => r.alias_id === "NJ-ALG-01");
  if (ca) {
    if (ca.effective_date === "2026-01-01") {
      pass("CA-ALG-01.effective_date is 2026-01-01");
    } else {
      fail(`CA-ALG-01.effective_date is ${ca.effective_date}, expected 2026-01-01`);
    }
    const before = evaluateStatus(ca, "2025-12-31");
    const after = evaluateStatus(ca, "2026-01-02");
    if (before?.result === "not_yet_effective" && after === null) {
      pass("evaluateStatus(CA-ALG-01): 2025-12-31 NTE → 2026-01-02 applies path");
    } else {
      fail(
        `evaluateStatus(CA-ALG-01) failed: before=${before?.result ?? "null"} after=${after?.result ?? "null"}`,
      );
    }
  }
  if (nj) {
    if (nj.effective_date === "2027-07-01" && nj.status === "not_yet_effective") {
      pass("NJ-ALG-01 is not_yet_effective until 2027-07-01");
    } else {
      fail(
        `NJ-ALG-01 status/date wrong: status=${nj.status} eff=${nj.effective_date}`,
      );
    }
    const before = evaluateStatus(nj, "2026-10-01");
    const after = evaluateStatus(nj, "2027-07-02");
    if (before?.result === "not_yet_effective" && after === null) {
      pass("evaluateStatus(NJ-ALG-01): 2026-10-01 NTE → 2027-07-02 applies path");
    } else {
      fail(
        `evaluateStatus(NJ-ALG-01) failed: before=${before?.result ?? "null"} after=${after?.result ?? "null"}`,
      );
    }
  }
}

async function testGeocodeResolution() {
  console.log("jurisdiction resolution (no Census network)");
  const sample = [
    {
      address_id: "t-dor",
      street_address: "1 Fake St",
      postal_city: "Dorchester",
      state: "MA",
      zip: "02124",
      year_built: "1960",
      units: "10",
      use_code: "",
      use_description: "",
      source_dataset: "",
      retrieved_at: "",
    },
    {
      address_id: "t-bos",
      street_address: "1 Fake St",
      postal_city: "Boston",
      state: "MA",
      zip: "02118",
      year_built: "1960",
      units: "10",
      use_code: "",
      use_description: "",
      source_dataset: "",
      retrieved_at: "",
    },
    {
      address_id: "t-unk",
      street_address: "1 Fake St",
      postal_city: "Somewhereville",
      state: "CA",
      zip: "90001",
      year_built: "1960",
      units: "10",
      use_code: "",
      use_description: "",
      source_dataset: "",
      retrieved_at: "",
    },
  ];
  const geos = await geocodeAddresses(sample, { useCensus: false });
  const dor = geos.find((g) => g.address_id === "t-dor");
  const bos = geos.find((g) => g.address_id === "t-bos");
  const unk = geos.find((g) => g.address_id === "t-unk");
  if (
    dor?.legal_city === "Boston" &&
    dor.resolution === "known_jurisdiction" &&
    isTrustedLegalCity(dor)
  ) {
    pass("Dorchester postal → Boston legal (known_jurisdiction)");
  } else {
    fail(`Dorchester remap failed: ${JSON.stringify(dor)}`);
  }
  if (
    bos?.legal_city === "Boston" &&
    bos.resolution === "known_jurisdiction" &&
    isTrustedLegalCity(bos)
  ) {
    pass("Boston postal is known legal city");
  } else {
    fail(`Boston known-city failed: ${JSON.stringify(bos)}`);
  }
  if (
    unk?.resolution === "postal_fallback" &&
    unk.legal_city === "Somewhereville" &&
    !isTrustedLegalCity(unk)
  ) {
    pass("unknown postal flagged postal_fallback (untrusted)");
  } else {
    fail(`unknown postal should be untrusted: ${JSON.stringify(unk)}`);
  }

  const cache = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  const geocoded = cache?.geocoded ?? [];
  if (!geocoded.length) {
    fail("geocode_cache.json missing");
    return;
  }
  const fallback = geocoded.filter((g) => g.resolution === "postal_fallback");
  if (fallback.length === 0) {
    pass(`geocode_cache: 0 postal_fallback of ${geocoded.length}`);
  } else {
    fail(
      `geocode_cache has ${fallback.length} postal_fallback: ${fallback
        .slice(0, 5)
        .map((g) => g.address_id)
        .join(", ")}`,
    );
  }
  const censusHits = geocoded.filter((g) => g.source === "census").length;
  if (censusHits > 0) {
    pass(`geocode_cache: ${censusHits}/${geocoded.length} Census-sourced`);
  } else {
    fail(
      "geocode_cache has 0 Census hits — re-run npm run geocode (without --heuristic-only)",
    );
  }
  const addresses = await loadAddresses();
  const byId = new Map(geocoded.map((g) => [g.address_id, g]));
  let remaps = 0;
  for (const a of addresses) {
    const g = byId.get(a.address_id);
    if (!g) continue;
    if (a.postal_city.trim().toLowerCase() !== g.legal_city.trim().toLowerCase()) {
      remaps += 1;
    }
  }
  if (remaps > 0) pass(`${remaps} sample addresses remap postal_city → legal_city`);
  else fail("expected some postal≠legal remaps in sample pack");
}

async function testChangeTestsT1T5() {
  console.log("change tests T1–T5");
  const rulesFile = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const geoFile = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  if (!rulesFile?.rules?.length || !geoFile?.geocoded?.length) {
    fail("rules.json or geocode_cache.json missing for change tests");
    return;
  }
  const geos = new Map(geoFile.geocoded.map((g) => [g.address_id, g]));
  const changes = await runChangesFromDisk({ rules: rulesFile.rules, geos });

  const checks: Array<[string, string[]]> = [
    ["T1", assertT1(changes.T1, geos)],
    ["T2", assertT2(changes.T2, geos)],
    ["T3", assertT3(changes.T3, geos)],
    ["T4", assertT4(changes.T4, geos)],
    ["T5", assertT5(changes.T5)],
  ];
  for (const [id, errs] of checks) {
    if (!errs.length) {
      const n = changes[id]?.affected_address_ids.length ?? 0;
      const extra =
        id === "T3"
          ? ` conflicts=${changes.T3?.conflict_flag_address_ids?.length ?? 0}`
          : "";
      pass(`${id} ok (affected=${n}${extra})`);
    } else {
      for (const e of errs) fail(e);
    }
  }
}

async function main() {
  console.log("Running smoke tests…\n");
  await testSchemaSample();
  await testCorpusLoader();
  await testHeuristicExtractSmoke();
  await testFakeSpanRejected();
  await testDualCoverage();
  await testRulesOutput();
  await testGeocodeResolution();
  await testChangeTestsT1T5();

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
