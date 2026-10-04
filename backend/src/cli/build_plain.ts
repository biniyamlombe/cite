import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { PlainLanguageFileSchema } from "@rhl/shared";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { buildPlainLanguageFile } from "../plain/headlines.js";

async function main() {
  const rulesPath = path.join(outputsDir(), "rules.json");
  const file = await readJson<{ rules: RuleRecord[] }>(rulesPath);
  const plain = buildPlainLanguageFile(file.rules ?? []);
  PlainLanguageFileSchema.parse(plain);
  const outPath = path.join(outputsDir(), "plain_language.json");
  await writeJson(outPath, plain);
  console.log(`Wrote ${plain.count} plain-language headlines → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
