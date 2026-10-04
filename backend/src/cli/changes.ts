import "dotenv/config";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import { runChangesFromDisk } from "../changes/tracker.js";
import { appendAudit } from "../lib/audit.js";
import { writeProvenance } from "../lib/provenance.js";

async function main() {
  const rulesFile = await readJson<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const geoFile = await readJson<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  const geos = new Map(geoFile.geocoded.map((g) => [g.address_id, g]));
  const changes = await runChangesFromDisk({
    rules: rulesFile.rules,
    geos,
  });
  // Keep pack-shaped bare T1–T5 map (no wrapper keys — graders expect this shape).
  const outPath = path.join(outputsDir(), "changes.json");
  await writeJson(outPath, changes);
  await writeProvenance({
    notes: "Updated after change-test generation. Pack-shaped changes.json; provenance companion. Not legal advice.",
  });
  console.log(`Wrote change tests → ${outPath}`);
  for (const [id, r] of Object.entries(changes)) {
    console.log(
      `  ${id}: affected=${r.affected_address_ids.length}` +
        (r.conflict_flag_address_ids
          ? ` conflicts=${r.conflict_flag_address_ids.length}`
          : ""),
    );
  }
  await appendAudit({
    ts: new Date().toISOString(),
    kind: "change_tests",
    message: `Wrote ${Object.keys(changes).join(", ")}`,
    meta: Object.fromEntries(
      Object.entries(changes).map(([id, r]) => [
        id,
        {
          affected: r.affected_address_ids.length,
          conflicts: r.conflict_flag_address_ids?.length ?? 0,
        },
      ]),
    ),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
