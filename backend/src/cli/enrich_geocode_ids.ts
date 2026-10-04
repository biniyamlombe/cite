/**
 * Backfill county_fips / place_geoid / state_fips onto existing geocode caches
 * without re-calling the Census network.
 */
import "dotenv/config";
import path from "node:path";
import { withJurisdictionIds } from "../geocode/jurisdiction_ids.js";
import type { GeocodeResult } from "../geocode/census.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { writeProvenance } from "../lib/provenance.js";

async function enrichFile(filename: string): Promise<void> {
  const filePath = path.join(outputsDir(), filename);
  const file = await readJson<{ geocoded: GeocodeResult[]; count?: number }>(
    filePath,
  );
  const geocoded = file.geocoded.map((g) => withJurisdictionIds(g));
  const withPlace = geocoded.filter((g) => g.place_geoid).length;
  const withCounty = geocoded.filter((g) => g.county_fips).length;
  await writeJson(filePath, { geocoded, count: geocoded.length });
  console.log(
    `${filename}: place_geoid=${withPlace}/${geocoded.length} county_fips=${withCounty}/${geocoded.length}`,
  );
}

async function main() {
  await enrichFile("geocode_cache.json");
  try {
    await enrichFile("stretch_geocode.json");
  } catch {
    /* stretch optional */
  }
  await writeProvenance({
    notes: "Updated after geocode FIPS/GEOID backfill. Not legal advice.",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
