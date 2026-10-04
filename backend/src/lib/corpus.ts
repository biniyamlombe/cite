import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCsv } from "./csv.js";
import { packRoot, secondaryCorpusDir } from "./paths.js";
import { readdir } from "node:fs/promises";

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
  while (i < Math.min(lines.length, 16)) {
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
    // Stretch secondary headers (not pack corpus).
    if (line.startsWith("JURISDICTION:") || line.startsWith("NOTE:")) {
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

/**
 * Public secondary reports (city news) captured under data/stretch/secondary_corpus.
 * Used when pack primary ordinance pages are link-only — never presented as municipal code.
 */
export async function loadSecondaryDocs(): Promise<CorpusDoc[]> {
  const dir = secondaryCorpusDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const docs: CorpusDoc[] = [];
  for (const name of names) {
    if (!name.endsWith(".txt")) continue;
    const textPath = path.join(dir, name);
    let text: string;
    try {
      text = await readFile(textPath, "utf8");
    } catch {
      continue;
    }
    const header = parseHeader(text);
    const jurisLine = text.split(/\r?\n/).find((l) => l.startsWith("JURISDICTION:"));
    const jurisdictions = (jurisLine?.slice("JURISDICTION:".length) ?? "")
      .split(/[|;,]/)
      .map((j) => j.trim())
      .filter(Boolean);
    docs.push({
      doc_id: path.basename(name, ".txt"),
      jurisdictions,
      url: header.url || "",
      retrieved_at: header.retrieved || "",
      text_file: textPath,
      text,
      body: header.body,
    });
  }
  return docs;
}

export async function loadDocById(docId: string): Promise<CorpusDoc | null> {
  const docs = await loadCapturableDocs();
  const hit = docs.find((d) => d.doc_id === docId);
  if (hit) return hit;
  const secondary = await loadSecondaryDocs();
  return secondary.find((d) => d.doc_id === docId) ?? null;
}

/**
 * Fold typography the model often "simplifies" (curly quotes, dashes, nbsp)
 * into ASCII. Keep 1:1 replacements so source index maps stay valid.
 */
export function foldTypography(ch: string): string {
  switch (ch) {
    case "\u2018": // ‘
    case "\u2019": // ’
    case "\u02BC": // ʼ
      return "'";
    case "\u201C": // “
    case "\u201D": // ”
      return '"';
    case "\u2013": // –
    case "\u2014": // —
      return "-";
    case "\u00A0": // nbsp
    case "\u202F": // narrow nbsp
      return " ";
    default:
      return ch;
  }
}

/** Normalize whitespace + typography for quoted_span membership checks. */
export function normalizeForMatch(s: string): string {
  let out = "";
  for (const ch of s) out += foldTypography(ch);
  return out.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Collapse whitespace + fold typography; map each out char → source index. */
export function collapseWhitespaceWithMap(s: string): {
  text: string;
  map: number[];
} {
  const map: number[] = [];
  let text = "";
  let i = 0;
  while (i < s.length && /\s/.test(foldTypography(s[i]!))) i += 1;
  let pendingWs: number | null = null;
  for (; i < s.length; i += 1) {
    const folded = foldTypography(s[i]!);
    if (/\s/.test(folded)) {
      if (pendingWs == null) pendingWs = i;
      continue;
    }
    if (pendingWs != null && text.length > 0) {
      text += " ";
      map.push(pendingWs);
      pendingWs = null;
    } else {
      pendingWs = null;
    }
    text += folded;
    map.push(i);
  }
  return { text, map };
}

/**
 * Snap a model/heuristic quote (often newline→space collapsed, curly quotes
 * straightened) back to the exact contiguous substring in `source`.
 */
export function snapQuotedSpanToSource(
  span: string,
  source: string,
): string | null {
  if (!span || span.length < 20) return null;
  if (source.includes(span)) return span;

  const collapsedSpan = [...span]
    .map(foldTypography)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsedSpan) return null;
  if (source.includes(collapsedSpan)) return collapsedSpan;

  const { text: nSource, map } = collapseWhitespaceWithMap(source);
  let needle = collapsedSpan;
  let idx = nSource.indexOf(needle);
  if (idx < 0) {
    idx = nSource.toLowerCase().indexOf(needle.toLowerCase());
  }
  if (idx < 0) {
    const compact = needle.replace(/\.{3}|…/g, " ").replace(/\s+/g, " ").trim();
    if (compact.length >= 20) {
      needle = compact;
      idx = nSource.toLowerCase().indexOf(compact.toLowerCase());
    }
  }
  // Models sometimes return overlong spans; try progressive prefix match.
  if (idx < 0 && collapsedSpan.length > 180) {
    for (const len of [220, 180, 140, 100, 80]) {
      if (collapsedSpan.length < len) continue;
      const prefix = collapsedSpan.slice(0, len).trim();
      if (prefix.length < 20) continue;
      idx = nSource.toLowerCase().indexOf(prefix.toLowerCase());
      if (idx >= 0) {
        needle = prefix;
        break;
      }
    }
  }
  if (idx < 0) return null;

  const endIdx = idx + needle.length - 1;
  const start = map[idx];
  const end = map[endIdx];
  if (start == null || end == null || end < start) return null;
  const exact = source.slice(start, end + 1);
  return exact.length >= 20 ? exact : null;
}

export function exactSpanInSource(span: string, source: string): boolean {
  return Boolean(span && span.length >= 20 && source.includes(span));
}

export function spanInSource(span: string, source: string): boolean {
  if (!span || span.length < 20) return false;
  if (source.includes(span)) return true;
  const nSpan = normalizeForMatch(span);
  const nSource = normalizeForMatch(source);
  if (nSource.includes(nSpan)) return true;
  // Allow truncated quotes with ellipsis removed
  const compact = nSpan.replace(/\.{3}|…/g, " ").replace(/\s+/g, " ");
  return nSource.includes(compact);
}
