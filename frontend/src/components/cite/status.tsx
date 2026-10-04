import { ArrowRight } from "lucide-react";
import { useLocale, useT, useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RESULT_ORDER, fmtDate } from "@/lib/cite/labels";
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
  const tx = useTx();
  const text =
    label ??
    (tx(`result.${value}`, "") || tx(`status.${value}`, value.replace(/_/g, " ")));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        TONE[value] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {text}
    </span>
  );
}

export function ResultSummaryChips({ results }: { results: LookupResult[] }) {
  const tx = useTx();
  const t = useT();
  const counts = RESULT_ORDER.map((k) => [k, results.filter((r) => r.result === k).length] as const);
  const conflicts = results.filter((r) => r.conflict_flag).length;
  const items: [string, string, number][] = [
    ...counts.map(
      ([k, n]) =>
        [k, tx(`result.${k}`, k), n] as [string, string, number],
    ),
    ["conflict", t("result.conflict"), conflicts],
  ];
  const highlight = new Set(["unknown", "conflict", "applies"]);
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([k, label, n], i) => {
        const hot = n > 0 && highlight.has(k);
        return (
          <div
            key={k}
            style={{ animationDelay: `${i * 40}ms` }}
            className={cn(
              "chip-stagger flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
              n === 0 && "opacity-35",
              hot && k === "unknown" && "border-unknown/35 bg-unknown-soft",
              hot && k === "conflict" && "border-conflict/35 bg-conflict-soft",
              hot && k === "applies" && "border-applies/30 bg-applies-soft/60",
              !hot && "bg-card",
            )}
          >
            <span className={cn("size-1.5 rounded-full", DOT[k])} />
            <span className="font-mono tabular-nums font-semibold text-ink">{n}</span>
            <span className={hot ? "text-ink/80" : "text-muted-foreground"}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BeforeAfterStatus({
  beforeDate, afterDate, before, after, label,
}: {
  beforeDate?: string | undefined;
  afterDate?: string | undefined;
  before?: string | undefined;
  after?: string | undefined;
  label?: string | undefined;
}) {
  const { locale } = useLocale();
  if (!before && !after) return null;
  return (
    <div className="rounded-md border bg-paper p-4">
      {label && <div className="eyebrow mb-3">{label}</div>}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        <div className="min-w-0">
          <div className="eyebrow">{beforeDate ? fmtDate(beforeDate, locale) : "Before"}</div>
          <div className="mt-2">{before ? <StatusBadge value={before} size="md" /> : <span className="text-sm text-muted-foreground">—</span>}</div>
        </div>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ArrowRight className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="eyebrow">{afterDate ? fmtDate(afterDate, locale) : "After"}</div>
          <div className="mt-2">{after ? <StatusBadge value={after} size="md" /> : <span className="text-sm text-muted-foreground">—</span>}</div>
        </div>
      </div>
    </div>
  );
}
