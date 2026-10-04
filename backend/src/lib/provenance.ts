import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ARTIFACT_SCHEMA_VERSION,
  PIPELINE_VERSION,
  type ArtifactProvenance,
} from "@rhl/shared";
import { writeJson } from "./io.js";
import { outputsDir, packRoot } from "./paths.js";

async function sha256File(filePath: string): Promise<string | null> {
  try {
    const buf = await readFile(filePath);
    return createHash("sha256").update(buf).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

/** Build reproducible provenance metadata for submission artifacts. */
export async function buildProvenance(options?: {
  asOf?: string;
  notes?: string;
}): Promise<ArtifactProvenance> {
  const pack = packRoot();
  const hashes: Record<string, string> = {};
  const inputs = [
    ["corpus_manifest", path.join(pack, "corpus", "corpus_manifest.csv")],
    ["sample_addresses", path.join(pack, "data", "sample_addresses.csv")],
    ["change_tests", path.join(pack, "dev", "change_tests.json")],
    ["rule_schema", path.join(pack, "schema", "rule_record.schema.json")],
    ["rules.json", path.join(outputsDir(), "rules.json")],
    ["lookups.json", path.join(outputsDir(), "lookups.json")],
    ["changes.json", path.join(outputsDir(), "changes.json")],
    ["geocode_cache.json", path.join(outputsDir(), "geocode_cache.json")],
  ] as const;

  for (const [key, filePath] of inputs) {
    const h = await sha256File(filePath);
    if (h) hashes[key] = h;
  }

  return {
    schema_version: ARTIFACT_SCHEMA_VERSION,
    pipeline_version: PIPELINE_VERSION,
    generated_at: new Date().toISOString(),
    ...(options?.asOf ? { as_of: options.asOf } : {}),
    pack_root: "data/pack",
    input_hashes: hashes,
    notes:
      options?.notes ??
      "Companion provenance for pack-shaped rules.json / lookups.json / changes.json. Not legal advice.",
  };
}

export async function writeProvenance(options?: {
  asOf?: string;
  notes?: string;
}): Promise<string> {
  const provenance = await buildProvenance(options);
  const outPath = path.join(outputsDir(), "provenance.json");
  await writeJson(outPath, provenance);
  return outPath;
}
