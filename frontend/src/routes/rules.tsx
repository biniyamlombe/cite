import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useT, useTx } from "@/lib/i18n";
import { getCiteClient } from "@/lib/cite/client";
import { CATEGORY_ORDER, confidenceBand, type ConfidenceBand } from "@/lib/cite/labels";
import type { Category, RuleStatus } from "@/lib/cite/types";
import { PageHeader } from "@/components/cite/layout";
import { RuleCard, RuleDetailDrawer, type RuleView } from "@/components/cite/rule";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rules — Cite" },
      { name: "description", content: "Browse extracted rental-housing rules with citations." },
      { property: "og:title", content: "Rules — Cite" },
      { property: "og:description", content: "Extracted rules with official citations and quoted source." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

const STATUSES: RuleStatus[] = ["in_force", "not_yet_effective", "pending", "failed"];
const CONF_BANDS: ConfidenceBand[] = ["high", "medium", "low"];

function FilterSelect({
  value,
  onChange,
  options,
  label,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
  allLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border/80 bg-paper/80 px-3.5 py-2 text-sm sm:flex-none">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-ink outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function RulesPage() {
  const t = useT();
  const tx = useTx();
  const { data, isPending, isError, error } = useQuery({ queryKey: ["rules"], queryFn: () => getCiteClient().rules() });
  const [jur, setJur] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [conf, setConf] = useState("");
  const [open, setOpen] = useState<RuleView | null>(null);
  const jurisdictions = useMemo(() => [...new Set((data ?? []).map((r) => r.jurisdiction))].sort(), [data]);
  const filtered = (data ?? []).filter((r) => {
    if (jur && r.jurisdiction !== jur) return false;
    if (cat && r.category !== cat) return false;
    if (status && r.status !== status) return false;
    if (conf && confidenceBand(r.confidence) !== conf) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("rules.eyebrow")} title={t("rules.title")}>
        {t("rules.lede")}
      </PageHeader>

      <div className="fade-up mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-paper/70 p-2 shadow-island backdrop-blur-xl">
        <FilterSelect
          label={t("rules.jurisdiction")}
          allLabel={t("rules.all")}
          value={jur}
          onChange={setJur}
          options={jurisdictions.map((j) => [j, j])}
        />
        <FilterSelect
          label={t("rules.category")}
          allLabel={t("rules.all")}
          value={cat}
          onChange={setCat}
          options={CATEGORY_ORDER.map((c) => [c, tx(`category.${c}`)] as [Category, string])}
        />
        <FilterSelect
          label={t("rules.status")}
          allLabel={t("rules.all")}
          value={status}
          onChange={setStatus}
          options={STATUSES.map((s) => [s, tx(`status.${s}`)] as [RuleStatus, string])}
        />
        <FilterSelect
          label={t("rules.confidence")}
          allLabel={t("rules.all")}
          value={conf}
          onChange={setConf}
          options={CONF_BANDS.map((b) => [b, t(`confidence.${b}`)] as [ConfidenceBand, string])}
        />
        <span className="ml-auto px-3 font-mono text-xs tabular-nums text-muted-foreground">
          {filtered.length} {t("rules.count")}
        </span>
      </div>
      <p className="fade-up mb-8 text-xs text-muted-foreground">{t("confidence.legend")}</p>

      {isPending && (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-28 rounded-xl" />
          ))}
        </div>
      )}
      {isError && (
        <div className="surface p-5 text-sm text-muted-foreground">
          {t("rules.error")} {(error as Error).message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((r) => {
          const v: RuleView = { id: r.team_rule_id, rule: r };
          return <RuleCard key={r.team_rule_id} view={v} onOpen={() => setOpen(v)} />;
        })}
      </div>
      {data && filtered.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("rules.empty")}</p>
      )}
      <RuleDetailDrawer view={open} onClose={() => setOpen(null)} />
    </div>
  );
}
