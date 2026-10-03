import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCsv } from "./csv.js";
import { packRoot } from "./paths.js";

export type ManifestRow = {
  doc_id: string;
  jurisdictions: string;
  url: string;
  source_type: string;
  capture: string;
  retrieved_at: string;
  sha256: string;
  text_file: string;
  status: string;
};

export type CorpusDoc = {
  doc_id: string;
  jurisdictions: string[];
  url: string;
  retrieved_at: string;
  text_file: string;
  text: string;
  body: string;
};

function parseHeader(text: string): { url?: string; retrieved?: string; body: string } {
  const lines = text.split(/\r?\n/);
  let url: string | undefined;
  let retrieved: string | undefined;
  let i = 0;
  while (i < Math.min(lines.length, 8)) {
    const line = lines[i] ?? "";
    if (line.startsWith("SOURCE:")) {
      url = line.slice("SOURCE:".length).trim();
      i += 1;
      continue;
    }
    if (line.startsWith("RETRIEVED:")) {
      retrieved = line.slice("RETRIEVED:".length).trim();
      i += 1;
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    break;
  }
  return { url, retrieved, body: lines.slice(i).join("\n") };
}

export async function loadManifest(): Promise<ManifestRow[]> {
  return readCsv<ManifestRow>(path.join(packRoot(), "corpus", "corpus_manifest.csv"));
}

export async function loadCapturableDocs(): Promise<CorpusDoc[]> {
  const rows = await loadManifest();
  const docs: CorpusDoc[] = [];
  for (const row of rows) {
    const capture = (row.capture || "").toLowerCase();
    if (capture !== "yes" && capture !== "true" && capture !== "1") continue;
    if (!row.text_file) continue;
    const textPath = path.join(packRoot(), "corpus", row.text_file);
    let text: string;
    try {
      text = await readFile(textPath, "utf8");
    } catch {
      continue;
    }
    if (!text.trim()) continue;
    const header = parseHeader(text);
    docs.push({
      doc_id: row.doc_id,
      jurisdictions: row.jurisdictions
        .split(/[|;,]/)
        .map((j) => j.trim())
        .filter(Boolean),
      url: header.url || row.url,
      retrieved_at: header.retrieved || row.retrieved_at,
      text_file: row.text_file,
      text,
      body: header.body,
    });
  }
  return docs;
}

export async function loadDocById(docId: string): Promise<CorpusDoc | null> {
  const docs = await loadCapturableDocs();
  return docs.find((d) => d.doc_id === docId) ?? null;
}

/** Normalize whitespace for quoted_span membership checks. */
export function normalizeForMatch(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function spanInSource(span: string, source: string): boolean {
  if (!span || span.length < 20) return false;
  const nSpan = normalizeForMatch(span);
  const nSource = normalizeForMatch(source);
  if (nSource.includes(nSpan)) return true;
  // Allow truncated quotes with ellipsis removed
  const compact = nSpan.replace(/\.{3}|…/g, " ").replace(/\s+/g, " ");
  return nSource.includes(compact);
}
