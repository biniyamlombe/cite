import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Ban,
  AlertTriangle,
  Scale,
  XCircle,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useT, useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/cite/labels";
import type { LookupResult } from "@/lib/cite/types";
import { summarizeCounts, type ResultGroupKey } from "@/lib/cite/result-groups";

const TONE: Record<string, string> = {
  applies: "bg-applies text-primary-foreground border-applies",
  unknown: "bg-unknown-soft text-unknown border-unknown/30",
  superseded:
    "bg-superseded-soft text-superseded border-superseded/25 line-through decoration-superseded/40",
  not_yet_effective: "bg-future-soft text-future border-future/25",
  pending: "bg-pending-soft text-pending border-pending/25 border-dashed",
  does_not_apply: "bg-superseded-soft text-superseded border-superseded/25",
  needs_human_review: "bg-conflict-soft text-conflict border-conflict/30",
  in_force: "bg-applies-soft text-applies border-applies/25",
  failed: "bg-superseded-soft text-superseded border-superseded/25",
  conflict: "bg-conflict-soft text-conflict border-conflict/30",
  pending_future: "bg-pending-soft text-pending border-pending/25 border-dashed",
};

const ICONS: Record<string, LucideIcon> = {
  applies: CheckCircle2,
  unknown: CircleHelp,
  superseded: Ban,
  not_yet_effective: Clock3,
  pending: Clock3,
  pending_future: Clock3,
  does_not_apply: XCircle,
  needs_human_review: AlertTriangle,
  in_force: Scale,
  failed: Ban,
  conflict: AlertTriangle,
};

const HELP: Record<string, string> = {
  applies: "status.help.applies",
  unknown: "status.help.unknown",
  does_not_apply: "status.help.does_not_apply",
  needs_human_review: "status.help.needs_human_review",
  pending: "status.help.pending",
  not_yet_effective: "status.help.not_yet_effective",
  pending_future: "status.help.pending",
  conflict: "status.help.conflict",
  in_force: "status.help.in_force",
  failed: "status.help.failed",
  superseded: "status.help.does_not_apply",
};

export function StatusBadge({
  value,
  label,
  size = "sm",
  kind,
}: {
  value: string;
  label?: string | undefined;
  size?: "sm" | "md";
  /** Screen-reader prefix, e.g. "Applicability" or "Legal status" */
  kind?: "applicability" | "legal_status" | undefined;
}) {
  const tx = useTx();
  const t = useT();
  const text =
    label ?? (tx(`result.${value}`, "") || tx(`status.${value}`, value.replace(/_/g, " ")));
  const Icon = ICONS[value] ?? HelpCircle;
  const helpKey = HELP[value];
  const help = helpKey ? t(helpKey as Parameters<typeof t>[0]) : text;
  const kindLabel =
    kind === "applicability"
      ? t("status.kind.applicability")
      : kind === "legal_status"
        ? t("status.kind.legal")
        : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        TONE[value] ?? "bg-muted text-muted-foreground border-border",
      )}
      title={help}
    >
      <Icon aria-hidden="true" className={size === "md" ? "size-3.5" : "size-3"} />
      <span>
        {kindLabel ? `${kindLabel}: ` : null}
        {text}
      </span>
      <span className="sr-only">. {help}</span>
    </span>
  );
}

const GROUP_LABEL: Record<ResultGroupKey, string> = {
  applies: "group.applies",
  unknown: "group.unknown",
  needs_human_review: "group.review",
  does_not_apply: "group.does_not_apply",
  pending_future: "group.pending",
};

export function ResultSummaryChips({ results }: { results: LookupResult[] }) {
  const t = useT();
  const { counts } = summarizeCounts(results);
  const items: Array<[ResultGroupKey, number]> = (
    Object.entries(counts) as Array<[ResultGroupKey, number]>
  ).filter(([k]) => k !== "does_not_apply" || counts.does_not_apply > 0);

  const highlight = new Set<ResultGroupKey>([
    "unknown",
    "needs_human_review",
    "applies",
    "pending_future",
  ]);
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label={t("lookup.summary")}>
      {items.map(([k, n], i) => {
        const hot = n > 0 && highlight.has(k);
        const Icon = ICONS[k] ?? HelpCircle;
        return (
          <div
            key={k}
            role="listitem"
            style={{ animationDelay: `${i * 40}ms` }}
            className={cn(
              "chip-stagger flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
              n === 0 && "opacity-35",
              hot && k === "unknown" && "border-unknown/35 bg-unknown-soft",
              hot && k === "needs_human_review" && "border-conflict/35 bg-conflict-soft",
              hot && k === "applies" && "border-applies/30 bg-applies-soft/60",
              hot && k === "pending_future" && "border-pending/35 bg-pending-soft",
              !hot && "bg-card",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0 opacity-80" />
            <span className="font-mono tabular-nums font-semibold text-ink">{n}</span>
            <span className={hot ? "text-ink/80" : "text-muted-foreground"}>
              {t(GROUP_LABEL[k] as Parameters<typeof t>[0])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function BeforeAfterStatus({
  beforeDate,
  afterDate,
  before,
  after,
  label,
}: {
  beforeDate?: string | undefined;
  afterDate?: string | undefined;
  before?: string | undefined;
  after?: string | undefined;
  label?: string | undefined;
}) {
  const { locale } = useLocale();
  const t = useT();
  if (!before && !after) return null;
  return (
    <div className="rounded-md border bg-paper p-4">
      {label && <div className="eyebrow mb-3">{label}</div>}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        <div className="min-w-0">
          <div className="eyebrow">{beforeDate ? fmtDate(beforeDate, locale) : t("changes.col.before")}</div>
          <div className="mt-2">
            {before ? (
              <StatusBadge value={before} size="md" kind="legal_status" />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ArrowRight className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="eyebrow">{afterDate ? fmtDate(afterDate, locale) : t("changes.col.after")}</div>
          <div className="mt-2">
            {after ? (
              <StatusBadge value={after} size="md" kind="legal_status" />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
