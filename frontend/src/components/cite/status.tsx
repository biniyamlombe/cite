import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESULT_LABEL, RESULT_ORDER, fmtDate, humanStatus } from "@/lib/cite/labels";
import type { LookupResult, LookupResultValue } from "@/lib/cite/types";

const TONE: Record<string, string> = {
  applies: "bg-applies text-primary-foreground border-applies",
  unknown: "bg-unknown-soft text-unknown border-unknown/30",
  superseded: "bg-superseded-soft text-superseded border-superseded/25 line-through decoration-superseded/40",
  not_yet_effective: "bg-future-soft text-future border-future/25",
  pending: "bg-pending-soft text-pending border-pending/25 border-dashed",
  in_force: "bg-applies-soft text-applies border-applies/25",
  failed: "bg-superseded-soft text-superseded border-superseded/25",
  conflict: "bg-conflict-soft text-conflict border-conflict/30",
};

const DOT: Record<string, string> = {
  applies: "bg-applies", unknown: "bg-unknown", superseded: "bg-superseded",
  not_yet_effective: "bg-future", pending: "bg-pending", conflict: "bg-conflict",
};

export function StatusBadge({ value, label, size = "sm" }: { value: string; label?: string | undefined; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        TONE[value] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {label ?? humanStatus(value)}
    </span>
  );
}

export function ResultSummaryChips({ results }: { results: LookupResult[] }) {
  const counts = RESULT_ORDER.map((k) => [k, results.filter((r) => r.result === k).length] as const);
  const conflicts = results.filter((r) => r.conflict_flag).length;
  const items: [string, string, number][] = [
    ...counts.map(([k, n]) => [k, RESULT_LABEL[k as LookupResultValue], n] as [string, string, number]),
    ["conflict", "Conflict-flagged", conflicts],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([k, label, n]) => (
        <div
          key={k}
          className={cn(
            "flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm",
            n === 0 && "opacity-45",
          )}
        >
          <span className={cn("size-1.5 rounded-full", DOT[k])} />
          <span className="font-mono tabular-nums font-semibold text-ink">{n}</span>
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function BeforeAfterStatus({
  beforeDate, afterDate, before, after,
}: { beforeDate?: string | undefined; afterDate?: string | undefined; before?: string | undefined; after?: string | undefined }) {
  if (!before && !after) return null;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md border bg-paper p-3">
      <div>
        <div className="eyebrow">{beforeDate ? fmtDate(beforeDate) : "Before"}</div>
        <div className="mt-1.5">{before && <StatusBadge value={before} />}</div>
      </div>
      <ArrowRight className="size-4 text-muted-foreground" />
      <div>
        <div className="eyebrow">{afterDate ? fmtDate(afterDate) : "After"}</div>
        <div className="mt-1.5">{after && <StatusBadge value={after} />}</div>
      </div>
    </div>
  );
}
