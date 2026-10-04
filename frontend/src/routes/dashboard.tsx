import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
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

type PulseItem = {
  id: string;
  at: number;
  kind: "lookup" | "memo" | "recheckChanged" | "recheckDue";
  label: string;
  href?: { to: "/"; search: { address: string } } | { to: "/memos" };
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Cite" },
      { name: "description", content: "Your regulatory monitoring at a glance: re-checks, recent memos, lookups and rule changes." },
      { property: "og:title", content: "Dashboard · Cite" },
      { property: "og:description", content: "Re-checks, memos, lookups and recent rule changes in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Card({
  title,
  to,
  viewAll,
  children,
}: {
  title: string;
  to?: string;
  viewAll: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="eyebrow">{title}</h3>
        {to && (
          <Link to={to} className="text-xs text-primary hover:underline">
            {viewAll}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const t = useT();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const watch = useWatchlist();
  const run = useServerFn(runMyRechecks);
  const changes = useQuery({ queryKey: ["changes", "dash"], queryFn: () => getCiteClient().changes() });
  const memos = useQuery({ queryKey: ["memos", user?.id], queryFn: listMemos, enabled: !!user });
  const audit = useQuery({ queryKey: ["audit", user?.id], queryFn: listAudit, enabled: !!user });
  const sched = useQuery({ queryKey: ["schedules", user?.id], queryFn: listSchedules, enabled: !!user });
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
  const muted = "text-sm text-muted-foreground";
  const viewAll = t("dashboard.viewAll");

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
    return items.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [audit.data, memos.data, sched.data, t]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("nav.dashboard")}>
        {t("dashboard.lede")}
      </PageHeader>

      {ready && !user && <SignInCard messageKey="dashboard.signin" />}

      {user && (
        <section className="surface mt-8 p-5 fade-up">
          <h3 className="eyebrow mb-3">{t("dashboard.activity")}</h3>
          {pulse.length ? (
            <ul className="divide-y text-sm">
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
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {Number.isFinite(item.at)
                      ? new Date(item.at).toISOString().slice(0, 16).replace("T", " ")
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={muted}>{t("dashboard.activityEmpty")}</p>
          )}
        </section>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card title={t("dashboard.rechecks")} to="/settings" viewAll={viewAll}>
          {!user ? (
            <p className={muted}>{t("dashboard.signinRequired")}</p>
          ) : sched.data?.length ? (
            <ul className="divide-y text-sm">
              {sched.data.map((s) => {
                const due = isScheduleDue(s.frequency, s.last_run_at);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link
                      to="/"
                      search={{ address: s.address_id }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {s.address_id}
                    </Link>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>
                        {s.frequency} ·{" "}
                        {s.last_run_at
                          ? s.last_run_at.slice(0, 16).replace("T", " ")
                          : t("dashboard.notRun")}
                      </span>
                      {due && (
                        <span className="rounded bg-unknown-soft px-1.5 py-0.5 text-[11px] font-medium text-unknown">
                          {t("settings.rechecks.due")}
                        </span>
                      )}
                      {s.last_changed && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">
                          {t("dashboard.changed")}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={muted}>{t("dashboard.rechecksEmpty")}</p>
          )}
          {user && (
            <button
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
              className="mt-3 rounded-full border border-border/80 px-3.5 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
            >
              {runNow.isPending ? t("dashboard.running") : t("dashboard.runNow")}
            </button>
          )}
          {runNow.data && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("dashboard.runSummary")
                .replace("{ran}", String(runNow.data.ran))
                .replace("{changed}", String(runNow.data.changed))
                .replace("{delivered}", String(runNow.data.delivered))
                .replace("{failed}", String(runNow.data.failed))
                .replace("{baselinesReset}", String(runNow.data.baselinesReset))}
            </p>
          )}
        </Card>

        <Card title={t("dashboard.changes")} to="/changes" viewAll={viewAll}>
          <ul className="divide-y text-sm">
            {changes.data?.tests.slice(0, 5).map((c) => (
              <li key={c.test_id} className="py-2">
                <span className="text-ink">{c.title}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {c.as_of ?? c.as_of_after ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t("dashboard.memos")} to="/memos" viewAll={viewAll}>
          {memos.data?.length ? (
            <ul className="divide-y text-sm">
              {memos.data.slice(0, 5).map((m) => (
                <li key={m.id} className="py-2">
                  {m.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className={muted}>{t("dashboard.memosEmpty")}</p>
          )}
        </Card>

        <Card title={t("dashboard.lookups")} to="/audit" viewAll={viewAll}>
          {audit.data?.length ? (
            <ul className="divide-y text-sm">
              {audit.data.slice(0, 5).map((a) => (
                <li key={a.id} className="flex justify-between py-2">
                  <span className="font-mono text-xs">
                    {a.address_id} · {a.as_of}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.created_at.slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={muted}>{t("dashboard.lookupsEmpty")}</p>
          )}
        </Card>

        <Card title={t("dashboard.watched")} to="/portfolio" viewAll={viewAll}>
          {watch.ids.length ? (
            <div className="flex flex-wrap gap-2">
              {watch.ids.map((id) => (
                <Link
                  key={id}
                  to="/"
                  search={{ address: id }}
                  className="rounded-full border px-2.5 py-0.5 font-mono text-xs hover:bg-secondary"
                >
                  {id}
                </Link>
              ))}
            </div>
          ) : (
            <p className={muted}>{t("dashboard.watchedEmpty")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
