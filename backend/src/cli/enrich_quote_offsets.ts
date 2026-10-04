/**
 * Backfill quote_start_offset / quote_end_offset on existing rules.json
 * without re-running LLM extraction.
 */
import "dotenv/config";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { loadCapturableDocs } from "../lib/corpus.js";
import { readJson, writeJson } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import { writeProvenance } from "../lib/provenance.js";

async function main() {
  const file = await readJson<{ rules: RuleRecord[] }>(
    path.join(outputsDir(), "rules.json"),
  );
  const docs = await loadCapturableDocs();
  const byId = new Map(docs.map((d) => [d.doc_id, d]));
  let filled = 0;
  let missing = 0;
  const rules = file.rules.map((r) => {
    const doc = r.source_doc_id ? byId.get(r.source_doc_id) : undefined;
    if (!doc || !r.quoted_span) {
      missing += 1;
      return { ...r, quote_start_offset: null, quote_end_offset: null };
    }
    const start = doc.text.indexOf(r.quoted_span);
    if (start < 0) {
      missing += 1;
      return { ...r, quote_start_offset: null, quote_end_offset: null };
    }
    filled += 1;
    return {
      ...r,
      quote_start_offset: start,
      quote_end_offset: start + r.quoted_span.length,
    };
  });
  const outPath = path.join(outputsDir(), "rules.json");
  await writeJson(outPath, { rules });
  await writeProvenance({
    notes: "Updated after quote-offset backfill. Not legal advice.",
  });
  console.log(
    `Quote offsets: filled=${filled} missing=${missing} → ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
