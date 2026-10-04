import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getCiteClient } from "@/lib/cite/client";
import { listAudit, listMemos } from "@/lib/cite/team";
import { isScheduleDue, listSchedules } from "@/lib/cite/ops";
import { runMyRechecks } from "@/lib/cite/ops.functions";
import { useWatchlist } from "@/lib/cite/watchlist";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { SignInCard } from "@/components/cite/sign-in-card";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cite" },
      { name: "description", content: "Your regulatory monitoring at a glance: re-checks, recent memos, lookups and rule changes." },
      { property: "og:title", content: "Dashboard — Cite" },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const muted = "text-sm text-muted-foreground";
  const viewAll = t("dashboard.viewAll");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("nav.dashboard")}>
        {t("dashboard.lede")}
      </PageHeader>

      {ready && !user && <SignInCard messageKey="dashboard.signin" />}

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
                .replace("{delivered}", String(runNow.data.delivered))}
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
