import "dotenv/config";
import path from "node:path";
import { loadAddresses } from "../lib/addresses.js";
import { writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { geocodeAddresses } from "../geocode/census.js";

async function main() {
  const noCensus = process.argv.includes("--heuristic-only");
  const addresses = await loadAddresses();
  const results = await geocodeAddresses(addresses, {
    useCensus: !noCensus,
    concurrency: 4,
  });
  const outPath = path.join(outputsDir(), "geocode_cache.json");
  await writeJson(outPath, { geocoded: results, count: results.length });
  const census = results.filter((r) => r.source === "census").length;
  console.log(
    `Wrote ${results.length} geocodes (${census} from Census) → ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
