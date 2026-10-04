import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bell, Eye, EyeOff } from "lucide-react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useWatchlist } from "@/lib/cite/watchlist";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { AsOfDate } from "@/components/cite/property";
import { StatusBadge } from "@/components/cite/status";
import type { LookupResponse } from "@/lib/cite/types";
import { GroupBar } from "@/components/cite/groups";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Cite" },
      { name: "description", content: "Every tracked property at a glance: rules that apply, conflicts, unknowns and upcoming changes." },
      { property: "og:title", content: "Portfolio — Cite" },
      { property: "og:description", content: "Monitor regulatory exposure across your rental portfolio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortfolioPage,
});

const plusYear = (d: string) => `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;
const PAGE_SIZE = 25;

function counts(d?: LookupResponse) {
  const r = d?.results ?? [];
  return {
    applies: r.filter((x) => x.result === "applies").length,
    unknown: r.filter((x) => x.result === "unknown").length,
    conflict: r.filter((x) => x.conflict_flag).length,
  };
}

/** Rules whose backend result differs between the two dates. */
function changesBetween(a?: LookupResponse, b?: LookupResponse) {
  if (!a || !b) return [];
  const before = new Map(a.results.map((r) => [r.team_rule_id, r.result]));
  return b.results
    .filter((r) => before.get(r.team_rule_id) !== r.result)
    .map((r) => ({
      id: r.team_rule_id,
      title: r.rule?.title ?? r.team_rule_id,
      from: before.get(r.team_rule_id) ?? "none",
      to: r.result,
      date: r.rule?.effective_date,
    }));
}

function PortfolioPage() {
  const t = useT();
  const [asOf, setAsOf] = useState(DEFAULT_AS_OF);
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [watchDefaultApplied, setWatchDefaultApplied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const horizon = plusYear(asOf);
  const watch = useWatchlist();
  const addrs = useQuery({ queryKey: ["addresses", ""], queryFn: () => getCiteClient().addresses("", 100) });
  const [group, setGroup] = useState<string[] | null>(null);

  const preferWatch = watch.ids.length > 0;
  const watchIds = watch.ids;

  // Once the browser watchlist loads, default to watched-only to avoid bulk lookups.
  useEffect(() => {
    if (!watchDefaultApplied && watchIds.length > 0) {
      setWatchedOnly(true);
      setWatchDefaultApplied(true);
    }
  }, [watchIds.length, watchDefaultApplied]);

  const list = useMemo(() => {
    const watched = new Set(watchIds);
    const base = (addrs.data ?? []).filter((a) => !group || group.includes(a.address_id));
    const filtered = watchedOnly ? base.filter((a) => watched.has(a.address_id)) : base;
    if (!preferWatch) return filtered;
    return [...filtered].sort((a, b) => {
      const aw = watched.has(a.address_id) ? 0 : 1;
      const bw = watched.has(b.address_id) ? 0 : 1;
      return aw - bw || a.address_id.localeCompare(b.address_id);
    });
  }, [addrs.data, group, watchedOnly, preferWatch, watchIds]);

  // Only fetch lookups for the visible page (or full watched set).
  const visible = watchedOnly || expanded || list.length <= PAGE_SIZE ? list : list.slice(0, PAGE_SIZE);
  const hiddenCount = Math.max(0, list.length - visible.length);

  const now = useQueries({
    queries: visible.map((a) => ({
      queryKey: ["lookup", a.address_id, asOf],
      queryFn: () => getCiteClient().lookup(a.address_id, asOf),
    })),
  });
  const later = useQueries({
    queries: visible.map((a) => ({
      queryKey: ["lookup", a.address_id, horizon],
      queryFn: () => getCiteClient().lookup(a.address_id, horizon),
    })),
  });

  const alerts = visible.flatMap((a, i) =>
    watch.has(a.address_id)
      ? changesBetween(now[i]?.data, later[i]?.data).map((c) => ({ ...c, addr: a }))
      : [],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("portfolio.eyebrow")} title={t("nav.portfolio")}>
        {t("portfolio.lede")}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <AsOfDate value={asOf} onChange={setAsOf} />
        <span className="pb-2 font-mono text-xs text-muted-foreground">
          {t("portfolio.horizon")} → {horizon}
        </span>
        {preferWatch && (
          <button
            type="button"
            onClick={() => {
              setWatchedOnly((v) => !v);
              setExpanded(false);
            }}
            aria-pressed={watchedOnly}
            className={`mb-0.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              watchedOnly
                ? "border-primary/40 bg-accent text-ink"
                : "border-border/80 bg-paper/80 text-muted-foreground hover:text-ink"
            }`}
          >
            {watchedOnly ? t("portfolio.filter.watchedOn") : t("portfolio.filter.watchedOff")}
          </button>
        )}
      </div>

      <GroupBar allIds={(addrs.data ?? []).map((a) => a.address_id)} onSelect={setGroup} />

      <section className="surface mb-8 p-5">
        <h3 className="eyebrow mb-3 flex items-center gap-2">
          <Bell className="size-3.5" /> {t("portfolio.alerts")}
        </h3>
        {watch.ids.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("portfolio.alerts.emptyWatch")}</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("portfolio.alerts.none")} {horizon}.
          </p>
        ) : (
          <ul className="divide-y">
            {alerts.map((al) => (
              <li key={al.addr.address_id + al.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <Link
                  to="/"
                  search={{ address: al.addr.address_id, as_of: horizon }}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {al.addr.address_id}
                </Link>
                <span className="text-ink">{al.title}</span>
                <StatusBadge value={al.from} /> <span className="text-muted-foreground">→</span>{" "}
                <StatusBadge value={al.to} />
                {al.date && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {t("portfolio.effective")} {al.date}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("portfolio.col.property")}</th>
              <th className="px-4 py-3">{t("portfolio.col.city")}</th>
              <th className="px-4 py-3 text-right">{t("result.applies")}</th>
              <th className="px-4 py-3 text-right">{t("result.unknown")}</th>
              <th className="px-4 py-3 text-right">{t("portfolio.col.conflicts")}</th>
              <th className="px-4 py-3 text-right">{t("portfolio.col.upcoming")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {addrs.isPending && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                  {t("portfolio.loading")}
                </td>
              </tr>
            )}
            {!addrs.isPending && list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {watchedOnly ? t("portfolio.empty.watched") : t("portfolio.empty")}
                </td>
              </tr>
            )}
            {visible.map((a, i) => {
              const c = counts(now[i]?.data);
              const up = changesBetween(now[i]?.data, later[i]?.data).length;
              const loading = now[i]?.isPending;
              const w = watch.has(a.address_id);
              return (
                <tr key={a.address_id} className={`hover:bg-secondary/40 ${w ? "bg-applies-soft/20" : ""}`}>
                  <td className="px-4 py-3">
                    <Link to="/" search={{ address: a.address_id, as_of: asOf }} className="text-ink hover:underline">
                      {a.street_address}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{a.address_id}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.legal_city ?? a.postal_city}, {a.state}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{loading ? "…" : c.applies}</td>
                  <td className={`px-4 py-3 text-right font-mono ${c.unknown ? "text-unknown" : ""}`}>
                    {loading ? "…" : c.unknown}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${c.conflict ? "text-destructive" : ""}`}>
                    {loading ? "…" : c.conflict}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{later[i]?.isPending ? "…" : up}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => watch.toggle(a.address_id)}
                      aria-pressed={w}
                      aria-label={w ? t("action.watching") : t("action.watch")}
                      className={`rounded-full border p-1.5 ${w ? "bg-secondary text-ink" : "text-muted-foreground hover:text-ink"}`}
                    >
                      {w ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hiddenCount > 0 && (
          <div className="border-t px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-full border border-border/80 px-4 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-ink"
            >
              {t("portfolio.showMore").replace("{n}", String(hiddenCount))}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
