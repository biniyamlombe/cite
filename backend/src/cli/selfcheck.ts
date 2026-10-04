/**
 * Offline self-check for submission artifacts. Writes outputs/selfcheck.txt.
 * Not the official organizer score.py.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { asCoverageObject, ChangesFileSchema, LookupsFileSchema } from "@rhl/shared";
import { exactSpanInSource, loadDocById } from "../lib/corpus.js";
import { readJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";

type Check = { name: string; ok: boolean; detail: string };

const EXPECTED: Record<string, number> = {
  T1: 250,
  T2: 90,
  T3: 140,
  T4: 110,
  T5: 0,
};

async function main() {
  const checks: Check[] = [];
  const rulesFile = await readJson<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const rules = rulesFile.rules ?? [];
  checks.push({
    name: "rules_loaded",
    ok: rules.length > 0,
    detail: `${rules.length} rules`,
  });

  const dual = rules.filter((r) => asCoverageObject(r.coverage_conditions));
  checks.push({
    name: "dual_coverage",
    ok: dual.length === rules.length,
    detail: `${dual.length}/${rules.length} dual coverage_conditions`,
  });

  let spanOk = 0;
  let spanChecked = 0;
  for (const rule of rules.slice(0, 40)) {
    if (!rule.source_doc_id || !rule.quoted_span) continue;
    const doc = await loadDocById(rule.source_doc_id);
    if (!doc?.text) continue;
    spanChecked += 1;
    if (exactSpanInSource(rule.quoted_span, doc.text)) spanOk += 1;
  }
  checks.push({
    name: "quoted_span_sample",
    ok: spanChecked === 0 || spanOk === spanChecked,
    detail: `${spanOk}/${spanChecked} sample spans found verbatim in corpus`,
  });

  const changes = ChangesFileSchema.parse(
    await readJson(path.join(outputsDir(), "changes.json")),
  );
  for (const [tid, n] of Object.entries(EXPECTED)) {
    const row = changes[tid];
    const got = row?.affected_address_ids?.length ?? -1;
    const per = row?.per_address ? Object.keys(row.per_address).length : 0;
    checks.push({
      name: `change_${tid}`,
      ok: got === n,
      detail: `affected=${got} expected=${n}; per_address=${per}`,
    });
  }
  checks.push({
    name: "change_T3_conflicts",
    ok: (changes.T3?.conflict_flag_address_ids?.length ?? 0) === 90,
    detail: `conflicts=${changes.T3?.conflict_flag_address_ids?.length ?? 0} expected=90`,
  });

  const lookupsPath = path.join(outputsDir(), "lookups.json");
  try {
    const lookups = LookupsFileSchema.parse(await readJson(lookupsPath));
    const ids = Object.keys(lookups.lookups);
    checks.push({
      name: "lookups_count",
      ok: ids.length === 500,
      detail: `${ids.length} addresses`,
    });
    let pendingAsApplies = 0;
    for (const id of ids.slice(0, 50)) {
      for (const e of lookups.lookups[id] ?? []) {
        if (
          e.result === "applies" &&
          (e.legal_status_at_as_of_date === "pending" ||
            e.legal_status_at_as_of_date === "not_yet_effective")
        ) {
          pendingAsApplies += 1;
        }
      }
    }
    checks.push({
      name: "no_pending_under_applies_sample",
      ok: pendingAsApplies === 0,
      detail: `violations_in_sample=${pendingAsApplies}`,
    });
  } catch (e) {
    checks.push({
      name: "lookups_count",
      ok: false,
      detail: `failed to read lookups.json: ${e instanceof Error ? e.message : e}`,
    });
  }

  const passed = checks.filter((c) => c.ok).length;
  const lines = [
    "Cite offline self-check",
    `generated_at: ${new Date().toISOString()}`,
    `result: ${passed}/${checks.length} checks passed`,
    "",
    ...checks.map((c) => `${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`),
    "",
    "Not legal advice. Not the official organizer score.py.",
  ];
  const outPath = path.join(outputsDir(), "selfcheck.txt");
  await fs.writeFile(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
  if (passed !== checks.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
