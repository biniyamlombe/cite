import type { LookupResult, LookupResultValue } from "./types";

/** UI grouping that keeps pending / not-yet-effective out of current-law Applies. */
export type ResultGroupKey =
  "applies" | "unknown" | "needs_human_review" | "does_not_apply" | "pending_future";

export const RESULT_GROUP_ORDER: ResultGroupKey[] = [
  "applies",
  "unknown",
  "needs_human_review",
  "does_not_apply",
  "pending_future",
];

export function groupKeyForResult(r: LookupResult): ResultGroupKey {
  if (r.needs_human_review || r.conflict_flag || r.applicability === "needs_human_review") {
    // Still show pending/NTE in pending section even if conflict-flagged
    if (r.result === "pending" || r.result === "not_yet_effective") return "pending_future";
    if (r.result === "applies") return "needs_human_review";
    if (r.result === "unknown") return "needs_human_review";
    if (r.result === "does_not_apply" || r.result === "superseded") return "does_not_apply";
    return "needs_human_review";
  }
  if (r.result === "pending" || r.result === "not_yet_effective") return "pending_future";
  if (r.result === "applies") return "applies";
  if (r.result === "unknown") return "unknown";
  if (r.result === "does_not_apply" || r.result === "superseded") return "does_not_apply";
  return "unknown";
}

export function groupResults(results: LookupResult[]): Array<[ResultGroupKey, LookupResult[]]> {
  const map = new Map<ResultGroupKey, LookupResult[]>();
  for (const key of RESULT_GROUP_ORDER) map.set(key, []);
  for (const r of results) {
    if (!r.rule) continue;
    const key = groupKeyForResult(r);
    map.get(key)!.push(r);
  }
  const out: Array<[ResultGroupKey, LookupResult[]]> = [];
  for (const k of RESULT_GROUP_ORDER) {
    const list = map.get(k)!;
    if (list.length) out.push([k, list]);
  }
  return out;
}

export function summarizeCounts(results: LookupResult[]) {
  const counts: Record<ResultGroupKey, number> = {
    applies: 0,
    unknown: 0,
    needs_human_review: 0,
    does_not_apply: 0,
    pending_future: 0,
  };
  for (const r of results) {
    if (!r.rule) continue;
    counts[groupKeyForResult(r)] += 1;
  }
  const byResult = results.reduce(
    (acc, r) => {
      acc[r.result] = (acc[r.result] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<LookupResultValue, number>>,
  );
  return { counts, byResult };
}
