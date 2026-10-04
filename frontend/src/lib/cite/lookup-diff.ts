import type { LookupResponse, LookupResult } from "./types";

export function resultIdentity(result: LookupResult): string {
  const r = result.rule;
  return (
    r?.stable_id ??
    (r?.alias_id
      ? `alias:${r.alias_id}`
      : r?.source_doc_id
        ? `doc:${r.source_doc_id}|${r.citation.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80)}|${r.title.toLowerCase().trim().slice(0, 60)}`
        : result.team_rule_id)
  );
}
/** Compare returned evidence and determinations only; never evaluate a legal rule. */
export function summarizeLookup(data: LookupResponse): Record<string, string> {
  return Object.fromEntries(
    data.results.map((result) => [
      resultIdentity(result),
      JSON.stringify({
        result: result.result,
        conflict: result.conflict_flag,
        evidence: result.rule
          ? {
              quote: result.rule.quoted_span,
              citation: result.rule.citation,
              source: result.rule.source_url,
              effective: result.rule.effective_date ?? null,
              requirement: result.rule.requirement,
              coverage: result.rule.coverage_conditions ?? null,
              exemptions: result.rule.exemptions ?? null,
              conflict_note: result.rule.conflict_note ?? null,
            }
          : null,
      }),
    ]),
  );
}
export function diffSummaries(before: Record<string, string>, after: Record<string, string>) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((id) => before[id] !== after[id])
    .map((id) => ({ id, from: before[id] ?? null, to: after[id] ?? null }));
}
export function changesBetween(before?: LookupResponse, after?: LookupResponse) {
  if (!before || !after) return [];
  const oldRows = new Map(before.results.map((r) => [resultIdentity(r), r]));
  const newRows = new Map(after.results.map((r) => [resultIdentity(r), r]));
  return diffSummaries(summarizeLookup(before), summarizeLookup(after)).map((change) => {
    const old = oldRows.get(change.id),
      next = newRows.get(change.id);
    const row = next ?? old!;
    return {
      id: change.id,
      title: row.rule?.title ?? row.team_rule_id,
      from: old?.result ?? "none",
      to: next?.result ?? "none",
      date: row.rule?.effective_date,
      detailsChanged: old?.result === next?.result,
    };
  });
}
