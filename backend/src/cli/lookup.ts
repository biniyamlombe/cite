import "dotenv/config";
import path from "node:path";
import { DEFAULT_AS_OF, type RuleRecord } from "@rhl/shared";
import { loadAddresses } from "../lib/addresses.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import { applyAll } from "../apply/coverage.js";
import { writeProvenance } from "../lib/provenance.js";

async function main() {
  const asOfArg = process.argv.find((a) => a.startsWith("--as-of="));
  const asOf = asOfArg?.split("=")[1] || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;

  const rulesFile = await readJson<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const geoFile = await readJson<{ geocoded: GeocodeResult[] }>(
    path.join(outputsDir(), "geocode_cache.json"),
  );
  const addresses = await loadAddresses();
  const geos = new Map(geoFile.geocoded.map((g) => [g.address_id, g]));

  const lookups = applyAll({
    addresses,
    geos,
    rules: rulesFile.rules,
    asOf,
  });

  // Stable address-id key order for deterministic JSON
  const ordered: typeof lookups = {};
  for (const id of Object.keys(lookups).sort((a, b) => a.localeCompare(b))) {
    ordered[id] = lookups[id]!;
  }

  const outPath = path.join(outputsDir(), "lookups.json");
  await writeJson(outPath, { as_of: asOf, lookups: ordered });
  await writeProvenance({ asOf, notes: "Updated after lookup generation. Not legal advice." });
  console.log(
    `Wrote lookups for ${Object.keys(ordered).length} addresses as_of=${asOf} → ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
