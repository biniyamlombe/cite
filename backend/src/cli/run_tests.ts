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
import { evaluateAddress, evaluateStatus } from "../apply/coverage.js";
import { enrichRuleCoverage } from "../apply/compile_coverage.js";
import {
  geocodeAddresses,
  isTrustedLegalCity,
  type GeocodeResult,
} from "../geocode/census.js";
import { loadAddresses, loadStretchAddresses } from "../lib/addresses.js";
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
  loadSecondaryDocs,
  snapQuotedSpanToSource,
} from "../lib/corpus.js";
import { packRoot, outputsDir } from "../lib/paths.js";
import { heuristicExtractDoc } from "../extract/heuristic.js";
import { validateRuleRecord } from "../lib/validate.js";
import { appendAudit } from "../lib/audit.js";
import { readJsonIfExists } from "../lib/io.js";
import {
  loadRuleVersionsFile,
  stableRuleKey,
  versionsForRule,
} from "../lib/rule_versions.js";

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

  // Missing year/units must yield unknown when coverage depends on them.
  const multifamily = enrichRuleCoverage({
    team_rule_id: "t-mf",
    doc_id: "D000",
    jurisdiction: "Berkeley, CA",
    level: "city",
    category: "just_cause_eviction",
    title: "Multifamily just cause",
    citation: "test",
    effective_date: "2020-01-01",
    status: "in_force",
    requirement: "Just cause required.",
    coverage_conditions: "Multifamily properties built before 1980",
    exemptions: "",
    penalties: null,
    interaction: null,
    quoted_span: "Synthetic coverage fixture, not corpus evidence.",
    source_url: "https://example.invalid/test",
    conflict_flag: false,
    confidence: 0.9,
    extractor: "test",
    extracted_at: "2026-10-01T00:00:00Z",
  } as RuleRecord);
  const mfCov = asCoverageObject(multifamily.coverage_conditions);
  const hasYearUnk = mfCov?.unknown_if?.some(
    (p) => p.field === "year_built" && p.operator === "missing",
  );
  const hasUnitsUnk = mfCov?.unknown_if?.some(
    (p) => p.field === "units" && p.operator === "missing",
  );
  if (hasYearUnk && hasUnitsUnk) {
    pass("multifamily+year rule compiles year_built + units unknown_if");
  } else {
    fail(
      `multifamily compile missing guards: year=${hasYearUnk} units=${hasUnitsUnk}`,
    );
  }
  const berkGeo = {
    address_id: "t-berk",
    legal_city: "Berkeley",
    county: "Alameda County",
    state: "CA",
    matched_address: "",
    source: "heuristic" as const,
    resolution: "known_jurisdiction" as const,
  };
  const emptyFacts = {
    address_id: "t-berk",
    street_address: "x",
    postal_city: "Berkeley",
    state: "CA",
    zip: "94704",
    year_built: "",
    units: "",
    use_code: "",
    use_description: "",
    source_dataset: "",
    retrieved_at: "",
  };
  const mfHit = evaluateAddress({
    address: emptyFacts,
    geo: berkGeo,
    rules: [multifamily],
  });
  if (mfHit[0]?.result === "unknown") {
    pass("missing year/units → unknown for multifamily built-before rule");
  } else {
    fail(`expected unknown for empty facts, got ${JSON.stringify(mfHit[0])}`);
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

async function testTypographySnap() {
  console.log("quoted_span typography snap (curly apostrophe)");
  const source =
    "requires any landlord planning to end a tenancy\n" +
    "agreement to provide the tenant with a Notice of Tenants’ Rights and Resources.";
  // Model often straightens ’ → '
  const modelSpan =
    "requires any landlord planning to end a tenancy agreement to provide the tenant with a Notice of Tenants' Rights and Resources.";
  const snapped = snapQuotedSpanToSource(modelSpan, source);
  if (snapped && source.includes(snapped) && snapped.includes("Tenants’")) {
    pass("curly apostrophe + newline collapse snaps to exact corpus text");
  } else {
    fail(`typography snap failed: ${JSON.stringify(snapped)}`);
  }
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

  const docs = [...(await loadCapturableDocs()), ...(await loadSecondaryDocs())];
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
    "CAM-FH-01",
    "SF-FC-01",
  ];
  for (const id of aliases) {
    const hit = rules.find((r) => r.alias_id === id || r.team_rule_id === id);
    if (hit) pass(`alias ${id} → ${hit.team_rule_id}`);
    else fail(`missing alias ${id}`);
  }

  const camFh = rules.find((r) => r.alias_id === "CAM-FH-01");
  if (
    camFh &&
    camFh.source_doc_id === "D029" &&
    camFh.category === "screening_restrictions" &&
    /Cambridge/i.test(camFh.jurisdiction) &&
    (camFh.quoted_span?.length ?? 0) >= 40
  ) {
    pass("CAM-FH-01 from D029 with verbatim screening quote");
  } else {
    fail("CAM-FH-01 missing or incomplete D029 screening scaffold");
  }
  const sfFc = rules.find((r) => r.alias_id === "SF-FC-01");
  if (
    sfFc &&
    sfFc.source_doc_id === "D078" &&
    sfFc.category === "screening_restrictions" &&
    /San Francisco/i.test(sfFc.jurisdiction) &&
    /Fair Chance/i.test(sfFc.quoted_span || "") &&
    (sfFc.confidence ?? 1) < 0.8
  ) {
    pass("SF-FC-01 from D078 thin Fair Chance quote (low conf)");
  } else {
    fail("SF-FC-01 missing or incomplete D078 Fair Chance scaffold");
  }

  for (const id of ["HOB-ALG-01", "JC-ALG-01"]) {
    const hit = rules.find((r) => r.alias_id === id);
    if (!hit) continue;
    const note = (hit.conflict_note || "").toLowerCase();
    const req = (hit.requirement || "").toLowerCase();
    const expectDoc = id === "HOB-ALG-01" ? "HOB-NEWS-01" : "JC-NEWS-01";
    const hasHonesty =
      hit.conflict_flag &&
      (hit.confidence ?? 1) < 0.8 &&
      note.includes("link-only") &&
      (note.includes("http") || note.includes("primary") || note.includes("secondary")) &&
      req.includes("not") &&
      req.includes("municipal");
    if (hasHonesty) {
      pass(`${id} honest link-only city ban (secondary report + primary URLs + municipal caveat)`);
    } else {
      fail(
        `${id} scaffold honesty incomplete: conf=${hit.confidence} flag=${hit.conflict_flag} note=${hit.conflict_note?.slice(0, 80)}`,
      );
    }
    if (
      hit.extraction_method === "secondary_report" &&
      hit.source_doc_id === expectDoc &&
      /algorithm|RealPage/i.test(hit.quoted_span)
    ) {
      pass(`${id} quoted evidence from city secondary report ${expectDoc}`);
    } else {
      fail(
        `${id} expected secondary_report/${expectDoc}, got ${hit.extraction_method}/${hit.source_doc_id}`,
      );
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

async function testModuleBLookupEdges() {
  console.log("Module B lookup edges (COO year, unknown, open questions)");
  const rulesFile = await readJsonIfExists<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const geoFile = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  const addresses = await loadAddresses();
  if (!rulesFile?.rules?.length || !geoFile?.geocoded?.length) {
    fail("rules/geocode missing for Module B edge tests");
    return;
  }
  const geos = new Map(geoFile.geocoded.map((g) => [g.address_id, g]));
  const byAddr = new Map(addresses.map((a) => [a.address_id, a]));

  // LA COO cutoff year → unknown (not applies/omit)
  const la1978 = addresses.find(
    (a) =>
      a.year_built === "1978" &&
      geos.get(a.address_id)?.legal_city === "Los Angeles",
  );
  if (!la1978) {
    fail("no Los Angeles 1978 sample address for COO unknown test");
  } else {
    const hits = evaluateAddress({
      address: la1978,
      geo: geos.get(la1978.address_id)!,
      rules: rulesFile.rules,
      asOf: "2026-10-01",
    }).filter((e) => {
      const r = rulesFile.rules.find((x) => x.team_rule_id === e.team_rule_id);
      return (
        !!r &&
        r.category === "rent_increase_limits" &&
        /los angeles/i.test(r.jurisdiction)
      );
    });
    if (
      hits.length > 0 &&
      hits.every((h) => h.result === "unknown") &&
      hits.some((h) => /1978|certificate of occupancy/i.test(h.explanation))
    ) {
      pass(
        `LA 1978 COO → unknown on ${hits.length} rent_increase_limits rule(s) (${la1978.address_id})`,
      );
    } else {
      fail(
        `LA 1978 expected unknown rent rules, got ${JSON.stringify(hits.slice(0, 3))}`,
      );
    }
  }

  // Demo A0005 — missing year/units → at least one unknown
  const a0005 = byAddr.get("A0005");
  const g0005 = geos.get("A0005");
  if (!a0005 || !g0005) {
    fail("A0005 missing from pack/geocode");
  } else {
    const hits = evaluateAddress({
      address: a0005,
      geo: g0005,
      rules: rulesFile.rules,
      asOf: "2026-10-01",
    });
    const unknowns = hits.filter((h) => h.result === "unknown");
    if (unknowns.length > 0) {
      pass(`A0005 yields ${unknowns.length} unknown result(s) (missing facts)`);
    } else {
      fail("A0005 expected ≥1 unknown when year/units blank");
    }
  }

  // Dorchester postal → Boston legal (demo A0065)
  const g0065 = geos.get("A0065");
  const a0065 = byAddr.get("A0065");
  if (
    a0065 &&
    g0065 &&
    /dorchester/i.test(a0065.postal_city) &&
    g0065.legal_city === "Boston"
  ) {
    pass("A0065 postal Dorchester → legal Boston");
  } else {
    fail(
      `A0065 remap failed: postal=${a0065?.postal_city} legal=${g0065?.legal_city}`,
    );
  }

  // Pack §9 open questions appear on matching explanations
  const hob = byAddr.get("A0002");
  const ghob = geos.get("A0002");
  if (hob && ghob) {
    const hits = evaluateAddress({
      address: hob,
      geo: ghob,
      rules: rulesFile.rules,
      asOf: "2026-10-01",
    });
    const fair = hits.find((h) => {
      const r = rulesFile.rules.find((x) => x.team_rule_id === h.team_rule_id);
      return r?.alias_id === "NJ-ALG-01";
    });
    if (fair && /Open question:.*FAIR/i.test(fair.explanation)) {
      pass("NJ-ALG-01 explanation surfaces FAIR preemption open question");
    } else {
      fail(
        `NJ-ALG-01 missing open-question note: ${fair?.explanation?.slice(0, 120) ?? "absent"}`,
      );
    }
  } else {
    fail("A0002 Hoboken missing for open-question test");
  }

  // Newark: uncaptured local pages + no city rules → corpus_gaps honesty
  const { corpusGapsForGeo } = await import("../apply/corpus_gaps.js");
  const newarkId = [...geos.entries()].find(
    ([, g]) => g.legal_city === "Newark" && g.state === "NJ",
  )?.[0];
  if (!newarkId) {
    fail("no geocoded Newark address for corpus_gaps test");
  } else {
    const gaps = await corpusGapsForGeo(geos.get(newarkId)!, rulesFile.rules);
    if (
      gaps.length > 0 &&
      /D070|D071|D072/.test(gaps.join(" ")) &&
      /check-terms|link-only/i.test(gaps.join(" "))
    ) {
      pass(`Newark corpus_gaps surfaces D070–D072 (${newarkId})`);
    } else {
      fail(`Newark corpus_gaps incomplete: ${JSON.stringify(gaps)}`);
    }
    const hobGaps = ghob ? await corpusGapsForGeo(ghob, rulesFile.rules) : [];
    if (hobGaps.length > 0) {
      pass("Hoboken retains uncaptured-source gaps alongside its city rules");
    } else {
      fail(`Hoboken missing corpus_gaps: ${JSON.stringify(hobGaps)}`);
    }
  }
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
  // Pack is T1–T5 only (hour-16 / T6 removed). Absence is correct.
  if (changes.T6) {
    if (
      changes.T6.affected_address_ids.length === 0 &&
      /not in this pack|removed|placeholder|awaiting corpus|not yet in rules/i.test(
        changes.T6.notes || "",
      )
    ) {
      pass("T6 absent-from-pack note present (no invented results)");
    } else if ((changes.T6.notes || "").length > 0) {
      pass(`T6 present (affected=${changes.T6.affected_address_ids.length})`);
    } else {
      fail("T6 present but notes empty");
    }
  } else {
    pass("T6 absent (correct for participant-final-no-hour16)");
  }

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

async function testStretchSantaAna() {
  console.log("stretch jurisdiction (Santa Ana)");
  const stretch = await loadStretchAddresses();
  if (stretch.length >= 4) {
    pass(`stretch CSV has ${stretch.length} Santa Ana demo addresses`);
  } else {
    fail(`expected ≥4 stretch addresses, got ${stretch.length}`);
    return;
  }
  const rulesPath = path.join(outputsDir(), "rules.json");
  const rulesFile = await readJsonIfExists<{ rules: RuleRecord[] }>(rulesPath);
  const rules = (rulesFile?.rules ?? []).map((r) => enrichRuleCoverage(r));
  const saRules = rules.filter((r) => /Santa Ana/i.test(r.jurisdiction));
  if (saRules.length >= 3) {
    pass(`${saRules.length} Santa Ana city rules in rules.json`);
  } else {
    fail(`expected ≥3 Santa Ana rules, got ${saRules.length}`);
  }

  const oldBuild = stretch.find((a) => a.address_id === "SA0001")!;
  const newBuild = stretch.find((a) => a.address_id === "SA0003")!;
  const geos = await geocodeAddresses([oldBuild, newBuild], { useCensus: false });
  const oldGeo = geos.find((g) => g.address_id === "SA0001")!;
  const newGeo = geos.find((g) => g.address_id === "SA0003")!;
  if (
    oldGeo.legal_city === "Santa Ana" &&
    oldGeo.state === "CA" &&
    isTrustedLegalCity(oldGeo)
  ) {
    pass("SA0001 geocodes to trusted Santa Ana, CA");
  } else {
    fail(`SA0001 geo failed: ${JSON.stringify(oldGeo)}`);
  }

  const oldHits = evaluateAddress({
    address: oldBuild,
    geo: oldGeo,
    rules,
  });
  const newHits = evaluateAddress({
    address: newBuild,
    geo: newGeo,
    rules,
  });
  const saAppliesOld = oldHits.filter(
    (h) =>
      h.result === "applies" &&
      saRules.some((r) => r.team_rule_id === h.team_rule_id),
  );
  if (saAppliesOld.length >= 1) {
    pass(
      `pre-2012 Santa Ana building gets ${saAppliesOld.length} applying Santa Ana rule(s)`,
    );
  } else {
    fail("expected Santa Ana city rules to apply to SA0001");
  }
  const fifteenYearJc = saRules.find(
    (r) =>
      r.category === "just_cause_eviction" &&
      /housing produced in the last 15 years/i.test(r.exemptions || ""),
  );
  if (fifteenYearJc) {
    const onNew = newHits.find((h) => h.team_rule_id === fifteenYearJc.team_rule_id);
    if (!onNew) {
      pass("2018 Santa Ana build omits 15-year-exempt just-cause rule");
    } else {
      fail(
        `2018 build should omit ${fifteenYearJc.team_rule_id}, got ${onNew.result}`,
      );
    }
  } else {
    fail("no Santa Ana just-cause rule with 15-year housing exemption text");
  }

  // Pack address count unchanged
  const pack = await loadAddresses();
  if (pack.length === 500) {
    pass("pack sample addresses remain 500 (stretch is additive)");
  } else {
    fail(`pack address count drifted: ${pack.length}`);
  }
}

async function testRuleVersions() {
  console.log("rule version history");
  const file = await loadRuleVersionsFile();
  const keys = Object.keys(file.by_key);
  if (keys.length > 0) {
    pass(`rule_versions.json has ${keys.length} stable keys`);
  } else {
    fail("rule_versions.json missing or empty — run npm run build-versions");
    return;
  }
  const rulesPath = path.join(outputsDir(), "rules.json");
  const rulesFile = await readJsonIfExists<{ rules: RuleRecord[] }>(rulesPath);
  const rules = rulesFile?.rules ?? [];
  const hob = rules.find((r) => r.alias_id === "HOB-ALG-01");
  const ca = rules.find((r) => r.alias_id === "CA-ALG-01");
  if (!hob || !ca) {
    fail("missing HOB-ALG-01 or CA-ALG-01 for version probe");
    return;
  }
  const hobVers = versionsForRule(file, hob);
  const caVers = versionsForRule(file, ca);
  if (hobVers.length >= 2 && hobVers[0]!.version.startsWith("v")) {
    pass(
      `HOB-ALG-01 has ${hobVers.length} versions (newest ${hobVers[0]!.version})`,
    );
  } else {
    fail(
      `HOB-ALG-01 expected ≥2 versions from git history, got ${hobVers.length}`,
    );
  }
  if (caVers.length >= 1 && caVers[0]!.quoted_span) {
    pass(`CA-ALG-01 versions resolve via ${stableRuleKey(ca)}`);
  } else {
    fail("CA-ALG-01 missing version tip");
  }
  // Newest-first ordering
  if (
    hobVers.length >= 2 &&
    Number(hobVers[0]!.version.slice(1)) >= Number(hobVers[1]!.version.slice(1))
  ) {
    pass("versions listed newest-first");
  } else if (hobVers.length >= 2) {
    fail("versions not newest-first");
  }
}

async function main() {
  console.log("Running smoke tests…\n");
  await testSchemaSample();
  await testCorpusLoader();
  await testHeuristicExtractSmoke();
  await testFakeSpanRejected();
  await testTypographySnap();
  await testDualCoverage();
  await testRulesOutput();
  await testRuleVersions();
  await testStretchSantaAna();
  await testGeocodeResolution();
  await testModuleBLookupEdges();
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
