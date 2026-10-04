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

/** Pending / NTE rows whose effective_date falls between asOf and horizon (display-only). */
export function approachingEffective(
  data: LookupResponse | undefined,
  asOf: string,
  horizon: string,
): Array<{
  id: string;
  title: string;
  result: string;
  date: string;
  daysUntil: number;
}> {
  if (!data) return [];
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const end = Date.parse(`${horizon}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const day = 86_400_000;
  return data.results
    .filter(
      (r) =>
        (r.result === "pending" || r.result === "not_yet_effective") && !!r.rule?.effective_date,
    )
    .map((r) => {
      const date = r.rule!.effective_date!;
      const t = Date.parse(`${date}T00:00:00Z`);
      return {
        id: resultIdentity(r),
        title: r.rule?.title ?? r.team_rule_id,
        result: r.result,
        date,
        daysUntil: Number.isFinite(t) ? Math.round((t - start) / day) : NaN,
        t,
      };
    })
    .filter((row) => Number.isFinite(row.t) && row.t >= start && row.t <= end)
    .sort((a, b) => a.t - b.t)
    .map(({ t: _t, ...row }) => row);
}
