import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT, useTx } from "@/lib/i18n";
import { getCiteClient } from "@/lib/cite/client";
import { CATEGORY_ORDER, confidenceBand, type ConfidenceBand } from "@/lib/cite/labels";
import type { Category, RuleStatus } from "@/lib/cite/types";
import { PageHeader } from "@/components/cite/layout";
import { RuleCard, RuleDetailDrawer, type RuleView } from "@/components/cite/rule";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rules · Cite" },
      { name: "description", content: "Browse extracted rental-housing rules with citations." },
      { property: "og:title", content: "Rules · Cite" },
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
    <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm sm:flex-none sm:min-w-[11rem]">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border/80 bg-card px-3 py-2 text-ink outline-none focus:border-ring"
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
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["rules"],
    queryFn: () => getCiteClient().rules(),
  });
  const [q, setQ] = useState("");
  const [jur, setJur] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [conf, setConf] = useState("");
  const [open, setOpen] = useState<RuleView | null>(null);

  const jurisdictions = useMemo(
    () => [...new Set((data ?? []).map((r) => r.jurisdiction))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? [])
      .filter((r) => {
        if (jur && r.jurisdiction !== jur) return false;
        if (cat && r.category !== cat) return false;
        if (status && r.status !== status) return false;
        if (conf && confidenceBand(r.confidence) !== conf) return false;
        if (needle) {
          const hay = [r.team_rule_id, r.title, r.citation, r.jurisdiction, r.requirement]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const j = a.jurisdiction.localeCompare(b.jurisdiction);
        if (j !== 0) return j;
        return a.title.localeCompare(b.title);
      });
  }, [data, jur, cat, status, conf, q]);

  const filtersActive = Boolean(q || jur || cat || status || conf);
  const clearFilters = () => {
    setQ("");
    setJur("");
    setCat("");
    setStatus("");
    setConf("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("rules.eyebrow")} title={t("rules.title")}>
        {t("rules.lede")}
      </PageHeader>

      <section className="fade-up border-b border-border/70 pb-5" aria-label={t("rules.filters")}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {isPending
              ? t("rules.loading")
              : t("rules.summary")
                  .replace("{shown}", String(filtered.length))
                  .replace("{total}", String(data?.length ?? 0))}
            {isFetching && !isPending ? "…" : ""}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("rules.clearFilters")}
            </button>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("rules.search")}
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("rules.searchPlaceholder")}
              name="rules-search"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full max-w-md border border-border/80 bg-card px-3 py-2 text-sm text-ink outline-none focus:border-ring"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
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
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("confidence.legend")}</p>
      </section>

      {isPending && (
        <div className="mt-8 space-y-4" aria-busy="true">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            {t("rules.loading")}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-28 rounded-md" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="mt-8 flex gap-3 border border-border/80 px-4 py-5 text-sm">
          <div>
            <p className="font-medium text-ink">{t("rules.error")}</p>
            <p className="mt-1 text-muted-foreground">{(error as Error).message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              {t("lookup.retry")}
            </button>
          </div>
        </div>
      )}

      {!isPending && !isError && (
        <>
          {filtered.length === 0 ? (
            <div className="mt-10 border border-dashed border-border/80 px-4 py-10 text-center">
              <p className="text-sm text-ink">{t("rules.empty")}</p>
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  {t("rules.clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {filtered.map((r, i) => {
                const v: RuleView = { id: r.team_rule_id, rule: r };
                return (
                  <RuleCard key={r.team_rule_id} view={v} index={i} onOpen={() => setOpen(v)} />
                );
              })}
            </div>
          )}
        </>
      )}

      <RuleDetailDrawer view={open} onClose={() => setOpen(null)} />
    </div>
  );
}
