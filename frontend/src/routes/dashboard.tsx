import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getCiteClient } from "@/lib/cite/client";
import { listAudit, listMemos } from "@/lib/cite/team";
import { listSchedules } from "@/lib/cite/ops";
import { runMyRechecks } from "@/lib/cite/ops.functions";
import { useWatchlist } from "@/lib/cite/watchlist";
import { PageHeader } from "@/components/cite/layout";

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

function Card({ title, to, children }: { title: string; to?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="eyebrow">{title}</h3>
        {to && <Link to={to} className="text-xs text-primary hover:underline">View all</Link>}
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const watch = useWatchlist();
  const run = useServerFn(runMyRechecks);
  const changes = useQuery({ queryKey: ["changes", "dash"], queryFn: () => getCiteClient().changes() });
  const memos = useQuery({ queryKey: ["memos", user?.id], queryFn: listMemos, enabled: !!user });
  const audit = useQuery({ queryKey: ["audit", user?.id], queryFn: listAudit, enabled: !!user });
  const sched = useQuery({ queryKey: ["schedules", user?.id], queryFn: listSchedules, enabled: !!user });
  const runNow = useMutation({ mutationFn: () => run(), onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }) });
  const muted = "text-sm text-muted-foreground";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Overview" title="Dashboard">Everything you're monitoring, in one place.</PageHeader>
      {ready && !user && <p className="mt-6 text-sm"><Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your re-checks, memos and history.</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card title="Scheduled re-checks" to="/settings">
          {!user ? <p className={muted}>Sign in required.</p> : sched.data?.length ? (
            <ul className="divide-y text-sm">
              {sched.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <Link to="/" search={{ address: s.address_id }} className="font-mono text-xs text-primary hover:underline">{s.address_id}</Link>
                  <span className="text-xs text-muted-foreground">{s.frequency} · {s.last_run_at ? s.last_run_at.slice(0, 16).replace("T", " ") : "not run yet"}</span>
                  {s.last_changed && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">changed</span>}
                </li>
              ))}
            </ul>
          ) : <p className={muted}>No re-checks scheduled yet.</p>}
          {user && (
            <button onClick={() => runNow.mutate()} disabled={runNow.isPending} className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
              {runNow.isPending ? "Running…" : "Run re-checks now"}
            </button>
          )}
          {runNow.data && <p className="mt-2 text-xs text-muted-foreground">Checked {runNow.data.ran}, changed {runNow.data.changed}, webhooks sent {runNow.data.delivered}.</p>}
        </Card>
        <Card title="Recent rule changes" to="/changes">
          <ul className="divide-y text-sm">
            {changes.data?.tests.slice(0, 5).map((c) => (
              <li key={c.test_id} className="py-2"><span className="text-ink">{c.title}</span> <span className="font-mono text-xs text-muted-foreground">{c.as_of ?? c.as_of_after ?? ""}</span></li>
            ))}
          </ul>
        </Card>
        <Card title="Recent memos" to="/memos">
          {memos.data?.length ? <ul className="divide-y text-sm">{memos.data.slice(0, 5).map((m) => <li key={m.id} className="py-2">{m.title}</li>)}</ul> : <p className={muted}>No memos yet.</p>}
        </Card>
        <Card title="Recent lookups" to="/audit">
          {audit.data?.length ? <ul className="divide-y text-sm">{audit.data.slice(0, 5).map((a) => <li key={a.id} className="flex justify-between py-2"><span className="font-mono text-xs">{a.address_id} · {a.as_of}</span><span className="text-xs text-muted-foreground">{a.created_at.slice(0, 16).replace("T", " ")}</span></li>)}</ul> : <p className={muted}>No lookups yet.</p>}
        </Card>
        <Card title="Watched properties" to="/portfolio">
          {watch.ids.length ? <div className="flex flex-wrap gap-2">{watch.ids.map((id) => <Link key={id} to="/" search={{ address: id }} className="rounded border px-2 py-0.5 font-mono text-xs hover:bg-secondary">{id}</Link>)}</div> : <p className={muted}>Nothing watched yet.</p>}
        </Card>
      </div>
    </div>
  );
}
