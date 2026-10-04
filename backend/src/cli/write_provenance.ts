import "dotenv/config";
import { DEFAULT_AS_OF } from "@rhl/shared";
import { writeProvenance } from "../lib/provenance.js";

async function main() {
  const asOfArg = process.argv.find((a) => a.startsWith("--as-of="));
  const asOf = asOfArg?.split("=")[1] || process.env.AS_OF_DEFAULT || DEFAULT_AS_OF;
  const out = await writeProvenance({ asOf });
  console.log(`Wrote provenance → ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
