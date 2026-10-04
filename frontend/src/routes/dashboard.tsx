import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { ArrowRight, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getCiteClient } from "@/lib/cite/client";
import { listAudit, listMemos } from "@/lib/cite/team";
import { isScheduleDue, listSchedules } from "@/lib/cite/ops";
import { runMyRechecks } from "@/lib/cite/ops.functions";
import { useWatchlist } from "@/lib/cite/watchlist";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { SignInCard } from "@/components/cite/sign-in-card";
import { StatusBadge } from "@/components/cite/status";
import type { TestId } from "@/lib/cite/types";

type PulseItem = {
  id: string;
  at: number;
  kind: "lookup" | "memo" | "recheckChanged" | "recheckDue";
  label: string;
  href?: { to: "/"; search: { address: string } } | { to: "/memos" };
};

type AttentionItem = {
  id: string;
  addressId: string;
  tone: "due" | "changed";
  detail: string;
};

const ORDER: TestId[] = ["T1", "T2", "T3", "T4", "T5"];

const PUNCH_KEYS: Record<
  TestId,
  "changes.punch.T1" | "changes.punch.T2" | "changes.punch.T3" | "changes.punch.T4" | "changes.punch.T5"
> = {
  T1: "changes.punch.T1",
  T2: "changes.punch.T2",
  T3: "changes.punch.T3",
  T4: "changes.punch.T4",
  T5: "changes.punch.T5",
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Cite" },
      {
        name: "description",
        content: "What needs review: due re-checks, changed properties, and Change Radar scenarios.",
      },
      { property: "og:title", content: "Dashboard · Cite" },
      {
        property: "og:description",
        content: "Attention queue for monitored properties and regulatory change scenarios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function fmtStamp(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 16).replace("T", " ");
}

function Dashboard() {
  const t = useT();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const watch = useWatchlist();
  const run = useServerFn(runMyRechecks);
  const changes = useQuery({
    queryKey: ["changes", "dash"],
    queryFn: () => getCiteClient().changes(),
  });
  const memos = useQuery({
    queryKey: ["memos", user?.id],
    queryFn: listMemos,
    enabled: !!user,
  });
  const audit = useQuery({
    queryKey: ["audit", user?.id],
    queryFn: listAudit,
    enabled: !!user,
  });
  const sched = useQuery({
    queryKey: ["schedules", user?.id],
    queryFn: listSchedules,
    enabled: !!user,
  });
  const runNow = useMutation({
    mutationFn: () => run(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      (data.failed ? toast.warning : toast.success)(
        t("dashboard.runSummary")
          .replace("{ran}", String(data.ran))
          .replace("{changed}", String(data.changed))
          .replace("{delivered}", String(data.delivered))
          .replace("{failed}", String(data.failed))
          .replace("{baselinesReset}", String(data.baselinesReset)),
      );
    },
  });

  const attention = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const s of sched.data ?? []) {
      if (s.last_changed) {
        items.push({
          id: `changed-${s.id}`,
          addressId: s.address_id,
          tone: "changed",
          detail: t("dashboard.attention.changedDetail").replace(
            "{when}",
            fmtStamp(s.last_run_at) ?? t("dashboard.notRun"),
          ),
        });
      } else if (isScheduleDue(s.frequency, s.last_run_at)) {
        items.push({
          id: `due-${s.id}`,
          addressId: s.address_id,
          tone: "due",
          detail: t("dashboard.attention.dueDetail").replace("{freq}", s.frequency),
        });
      }
    }
    // Changed first, then due
    return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "changed" ? -1 : 1));
  }, [sched.data, t]);

  const pulse = useMemo(() => {
    const items: PulseItem[] = [];
    for (const a of audit.data ?? []) {
      items.push({
        id: `lookup-${a.id}`,
        at: new Date(a.created_at).getTime(),
        kind: "lookup",
        label: t("dashboard.activity.lookup").replace("{id}", a.address_id),
        href: { to: "/", search: { address: a.address_id } },
      });
    }
    for (const m of memos.data ?? []) {
      items.push({
        id: `memo-${m.id}`,
        at: new Date(m.created_at).getTime(),
        kind: "memo",
        label: t("dashboard.activity.memo").replace("{title}", m.title),
        href: { to: "/memos" },
      });
    }
    for (const s of sched.data ?? []) {
      if (s.last_changed && s.last_run_at) {
        items.push({
          id: `changed-${s.id}`,
          at: new Date(s.last_run_at).getTime(),
          kind: "recheckChanged",
          label: t("dashboard.activity.recheckChanged").replace("{id}", s.address_id),
          href: { to: "/", search: { address: s.address_id } },
        });
      } else if (isScheduleDue(s.frequency, s.last_run_at)) {
        items.push({
          id: `due-${s.id}`,
          at: s.last_run_at ? new Date(s.last_run_at).getTime() : Date.now(),
          kind: "recheckDue",
          label: t("dashboard.activity.recheckDue").replace("{id}", s.address_id),
          href: { to: "/", search: { address: s.address_id } },
        });
      }
    }
    return items.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [audit.data, memos.data, sched.data, t]);

  const results = changes.data?.results ?? {};
  const conflictCount = results["T3"]?.conflict_flag_address_ids?.length ?? 0;
  const dueCount = attention.filter((a) => a.tone === "due").length;
  const changedCount = attention.filter((a) => a.tone === "changed").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader title={t("dashboard.title")}>{t("dashboard.lede")}</PageHeader>

      <div className="fade-up flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("dashboard.cta.lookup")}
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          to="/changes"
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-sm text-ink transition-colors hover:bg-secondary"
        >
          {t("dashboard.cta.changes")}
        </Link>
        {user && (
          <button
            type="button"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            className="inline-flex items-center gap-2 rounded-full border border-border/80 px-4 py-2 text-sm text-ink transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {runNow.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("dashboard.running")}
              </>
            ) : (
              t("dashboard.runNow")
            )}
          </button>
        )}
      </div>

      {ready && !user && (
        <div className="mt-8">
          <SignInCard messageKey="dashboard.signin" />
        </div>
      )}

      {/* Attention queue — primary job of this page */}
      <section className="fade-up mt-10" aria-labelledby="dash-attention">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 id="dash-attention" className="font-serif text-2xl tracking-[-0.02em] text-ink">
              {t("dashboard.attention")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.attention.lede")}</p>
          </div>
          {user && (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {changedCount} {t("dashboard.changed").toLowerCase()} · {dueCount}{" "}
              {t("settings.rechecks.due").toLowerCase()} · {watch.ids.length}{" "}
              {t("dashboard.watched").toLowerCase()}
            </p>
          )}
        </div>

        {!user ? (
          <p className="mt-5 text-sm text-muted-foreground">{t("dashboard.attention.signedOut")}</p>
        ) : attention.length === 0 ? (
          <div className="mt-5 flex gap-3 rounded-md border border-border/80 bg-card/80 px-4 py-5">
            <Bell className="mt-0.5 size-4 shrink-0 text-primary/70" />
            <div>
              <p className="text-sm text-ink">{t("dashboard.attention.empty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.attention.emptyHint")}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link to="/portfolio" className="text-primary hover:underline">
                  {t("nav.portfolio")}
                </Link>
                <Link to="/settings" className="text-primary hover:underline">
                  {t("nav.settings")}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-border/70">
            {attention.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/"
                      search={{ address: item.addressId }}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {item.addressId}
                    </Link>
                    {item.tone === "changed" ? (
                      <StatusBadge value="conflict" label={t("dashboard.changed")} />
                    ) : (
                      <StatusBadge value="not_yet_effective" label={t("settings.rechecks.due")} />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <Link
                  to="/"
                  search={{ address: item.addressId }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink hover:text-primary"
                >
                  {t("dashboard.openLookup")}
                  <ArrowRight className="size-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {runNow.data && (
          <p className="mt-4 text-xs text-muted-foreground">
            {t("dashboard.runSummary")
              .replace("{ran}", String(runNow.data.ran))
              .replace("{changed}", String(runNow.data.changed))
              .replace("{delivered}", String(runNow.data.delivered))
              .replace("{failed}", String(runNow.data.failed))
              .replace("{baselinesReset}", String(runNow.data.baselinesReset))}
          </p>
        )}
      </section>

      {/* Change Radar snapshot — display-only from API */}
      <section className="fade-up mt-12" aria-labelledby="dash-radar">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 id="dash-radar" className="font-serif text-2xl tracking-[-0.02em] text-ink">
              {t("dashboard.radar")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.radar.lede")}</p>
          </div>
          <Link to="/changes" className="text-sm text-primary hover:underline">
            {t("dashboard.viewAll")}
          </Link>
        </div>

        {changes.isLoading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            {t("changes.loading")}
          </div>
        ) : changes.isError ? (
          <p className="mt-5 text-sm text-destructive">{t("dashboard.radar.error")}</p>
        ) : (
          <>
            <nav aria-label={t("dashboard.radar")} className="mt-5 grid gap-2 sm:grid-cols-5">
              {ORDER.map((id) => {
                const present = !!changes.data?.tests.some((x) => x.test_id === id);
                const n = results[id]?.affected_address_ids.length ?? 0;
                const conflicts = results[id]?.conflict_flag_address_ids?.length ?? 0;
                return (
                  <Link
                    key={id}
                    to="/changes"
                    hash={id}
                    className={`rounded-md border border-border/80 bg-card/90 px-3 py-3 transition-colors hover:border-primary/30 hover:bg-accent/40 ${
                      present ? "" : "opacity-45"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span translate="no" className="font-mono text-xs font-semibold text-primary">
                        {id}
                      </span>
                      <span className="font-mono text-lg tabular-nums text-ink">
                        {present ? n : "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      {t(PUNCH_KEYS[id])}
                    </div>
                    {conflicts > 0 && (
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-conflict">
                        {conflicts} {t("status.conflict").toLowerCase()}
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>
            {conflictCount > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("dashboard.radar.conflictHint").replace("{n}", String(conflictCount))}
              </p>
            )}
          </>
        )}
      </section>

      {/* Secondary: watched + activity — quieter, not twin cards */}
      <div className="fade-up mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="dash-watched">
          <div className="flex items-end justify-between gap-3 border-b border-border/70 pb-3">
            <h2 id="dash-watched" className="font-serif text-xl tracking-[-0.02em] text-ink">
              {t("dashboard.watched")}
            </h2>
            <Link to="/portfolio" className="text-xs text-primary hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          {watch.ids.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {watch.ids.map((id) => (
                <Link
                  key={id}
                  to="/"
                  search={{ address: id }}
                  className="rounded-full border border-border/80 bg-card px-3 py-1 font-mono text-xs text-ink transition-colors hover:border-primary/35 hover:bg-accent/50"
                >
                  {id}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t("dashboard.watchedEmpty")}</p>
          )}

          {user && (
            <>
              <h3 className="mt-8 font-serif text-lg text-ink">{t("dashboard.memos")}</h3>
              {memos.data?.length ? (
                <ul className="mt-2 divide-y divide-border/60 text-sm">
                  {memos.data.slice(0, 4).map((m) => (
                    <li key={m.id} className="py-2.5">
                      <Link to="/memos" className="text-ink hover:text-primary hover:underline">
                        {m.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("dashboard.memosEmpty")}</p>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="dash-activity">
          <div className="flex items-end justify-between gap-3 border-b border-border/70 pb-3">
            <h2 id="dash-activity" className="font-serif text-xl tracking-[-0.02em] text-ink">
              {t("dashboard.activity")}
            </h2>
            {user && (
              <Link to="/audit" className="text-xs text-primary hover:underline">
                {t("dashboard.lookups")}
              </Link>
            )}
          </div>
          {!user ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("dashboard.activity.signedOut")}</p>
          ) : pulse.length ? (
            <ul className="mt-2 divide-y divide-border/60 text-sm">
              {pulse.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  {item.href?.to === "/" ? (
                    <Link
                      to="/"
                      search={item.href.search}
                      className="text-ink hover:text-primary hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : item.href?.to === "/memos" ? (
                    <Link to="/memos" className="text-ink hover:text-primary hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-ink">{item.label}</span>
                  )}
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {Number.isFinite(item.at)
                      ? new Date(item.at).toISOString().slice(0, 16).replace("T", " ")
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t("dashboard.activityEmpty")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
