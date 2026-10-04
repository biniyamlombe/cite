/**
 * Stretch goal: extend the same extract → geocode → coverage pipeline to
 * Santa Ana (corpus + rules already present; pack has no SA sample addresses).
 *
 * Writes separate stretch outputs so pack T1–T5 (500 addresses) stay untouched.
 */
import "dotenv/config";
import path from "node:path";
import { DEFAULT_AS_OF, type RuleRecord } from "@rhl/shared";
import { loadStretchAddresses } from "../lib/addresses.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { geocodeAddresses, type GeocodeResult } from "../geocode/census.js";
import { applyAll } from "../apply/coverage.js";
import { appendAudit } from "../lib/audit.js";

async function main() {
  const asOf =
    process.argv.find((a) => a.startsWith("--as-of="))?.split("=")[1] ||
    process.env.AS_OF_DEFAULT ||
    DEFAULT_AS_OF;
  const useCensus = !process.argv.includes("--heuristic-geo");

  const stretch = await loadStretchAddresses();
  if (!stretch.length) {
    console.error("No stretch addresses found at data/stretch/santa_ana_addresses.csv");
    process.exit(1);
  }

  const rulesFile = await readJson<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const saRules = rulesFile.rules.filter((r) =>
    /Santa Ana/i.test(r.jurisdiction),
  );
  if (!saRules.length) {
    console.error("No Santa Ana rules in rules.json — run extract first.");
    process.exit(1);
  }

  const geos = await geocodeAddresses(stretch, { useCensus });
  const geoPath = path.join(outputsDir(), "stretch_geocode.json");
  await writeJson(geoPath, { geocoded: geos as GeocodeResult[] });

  const geoMap = new Map(geos.map((g) => [g.address_id, g]));
  const stretchLookups = applyAll({
    addresses: stretch,
    geos: geoMap,
    rules: rulesFile.rules,
    asOf,
  });

  const lookupPath = path.join(outputsDir(), "stretch_lookups.json");
  await writeJson(lookupPath, { as_of: asOf, lookups: stretchLookups });

  await appendAudit({
    ts: new Date().toISOString(),
    kind: "note",
    message: `Stretch Santa Ana: geocoded+lookup ${stretch.length} addresses; ${saRules.length} city rules`,
    meta: {
      stretch_addresses: stretch.length,
      santa_ana_rules: saRules.length,
      as_of: asOf,
      heuristic_geo: !useCensus,
    },
  });

  console.log(
    `Stretch Santa Ana: ${stretch.length} addresses, ${saRules.length} city rules, as_of=${asOf}`,
  );
  console.log(`  geocode → ${geoPath}`);
  console.log(`  lookups → ${lookupPath}`);
  for (const a of stretch) {
    const g = geoMap.get(a.address_id);
    const hits = stretchLookups[a.address_id] || [];
    const applies = hits.filter((h) => h.result === "applies").length;
    const unknown = hits.filter((h) => h.result === "unknown").length;
    const sa = hits.filter((h) =>
      saRules.some((r) => r.team_rule_id === h.team_rule_id),
    ).length;
    console.log(
      `  ${a.address_id} → ${g?.legal_city}, ${g?.state} | results=${hits.length} applies=${applies} unknown=${unknown} santa_ana=${sa}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
