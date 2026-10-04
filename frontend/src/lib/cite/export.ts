import type { LookupResponse } from "./types";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Serialises a lookup response exactly as returned — no re-evaluation. */
export function lookupToCsv(d: LookupResponse): string {
  const head = [
    "address_id",
    "as_of",
    "team_rule_id",
    "result",
    "conflict",
    "title",
    "citation",
    "jurisdiction",
    "effective_date",
    "confidence",
    "retrieved_at",
    "source_url",
    "explanation",
  ];
  const rows = d.results.map((r) => [
    d.address.address_id,
    d.as_of,
    r.team_rule_id,
    r.result,
    r.conflict_flag,
    r.rule?.title,
    r.rule?.citation,
    r.rule?.jurisdiction,
    r.rule?.effective_date,
    r.rule?.confidence,
    r.rule?.retrieved_at,
    r.rule?.source_url,
    r.explanation,
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
