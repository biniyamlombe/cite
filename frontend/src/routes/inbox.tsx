import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpRight, AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/cite/layout";
import { SignInCard } from "@/components/cite/sign-in-card";
import { StatusBadge } from "@/components/cite/status";
import { useAuth } from "@/lib/auth";
import { getCiteClient, DEFAULT_AS_OF } from "@/lib/cite/client";
import { listChangeReviews, saveChangeReview, type ChangeReviewStatus } from "@/lib/cite/change-reviews";
import { listSchedules } from "@/lib/cite/ops";
import { useWatchlist } from "@/lib/cite/watchlist";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [
    { title: "Change impact inbox — Cite" },
    { name: "description", content: "Triage change scenarios affecting monitored properties with review states and notes." },
    { property: "og:title", content: "Change impact inbox — Cite" },
    { property: "og:description", content: "Triage change scenarios affecting monitored properties with review states and notes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InboxPage,
});

const STATES: ChangeReviewStatus[] = ["unreviewed", "needs_counsel", "reviewed", "dismissed"];
type Filter = "all" | ChangeReviewStatus;

function InboxPage() {
  const t = useT();
  const { user, ready } = useAuth();
  const watch = useWatchlist();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const client = getCiteClient();
  const changes = useQuery({ queryKey: ["changes"], queryFn: () => client.changes(), enabled: !!user });
  const addresses = useQuery({ queryKey: ["addresses", "", 500], queryFn: () => client.addresses("", 500), enabled: !!user });
  const schedules = useQuery({ queryKey: ["inbox-schedules", user?.id], queryFn: listSchedules, enabled: !!user });
  const reviews = useQuery({ queryKey: ["change-reviews", user?.id], queryFn: listChangeReviews, enabled: !!user });
  const save = useMutation({
    mutationFn: ({ changeId, addressId, status, note }: { changeId: string; addressId: string; status: ChangeReviewStatus; note: string }) =>
      saveChangeReview(changeId, addressId, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-reviews", user?.id] }),
  });

  const monitored = useMemo(() => new Set([...watch.ids, ...(schedules.data ?? []).map((s) => s.address_id)]), [watch.ids, schedules.data]);
  const addressMap = useMemo(() => new Map((addresses.data ?? []).map((a) => [a.address_id, a])), [addresses.data]);
  const items = useMemo(() => (changes.data?.tests ?? []).flatMap((test) => {
    const result = changes.data?.results[test.test_id];
    return (result?.affected_address_ids ?? []).filter((id) => monitored.has(id)).map((addressId) => ({
      test, result, addressId, review: reviews.data?.find((r) => r.change_id === test.test_id && r.address_id === addressId),
    }));
  }), [changes.data, monitored, reviews.data]);
  const filtered = items.filter((item) => filter === "all" || (item.review?.status ?? "unreviewed") === filter);
  const counts = Object.fromEntries(STATES.map((state) => [state, items.filter((item) => (item.review?.status ?? "unreviewed") === state).length]));
  const loading = changes.isPending || addresses.isPending || schedules.isPending || reviews.isPending;
  const error = changes.error || addresses.error || schedules.error || reviews.error;

  return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
    <PageHeader eyebrow={t("inbox.eyebrow")} title={t("inbox.heading")}>{t("inbox.lede")}</PageHeader>
    {!ready && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
    {ready && !user && <SignInCard messageKey="inbox.signin" />}
    {user && <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
        <div className="flex items-baseline gap-3"><span className="font-serif text-3xl text-ink">{loading ? "—" : items.length}</span><span className="eyebrow">{t("inbox.matches")}</span></div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("inbox.filter")}>
          {(["all", ...STATES] as Filter[]).map((state) => <button key={state} type="button" aria-pressed={filter === state} onClick={() => setFilter(state)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${filter === state ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-ink"}`}>{t(`inbox.${state}`)} <span className="ml-1 font-mono opacity-70">{loading ? "—" : state === "all" ? items.length : counts[state]}</span></button>)}
        </div>
      </div>
      <p className="mb-5 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground">{t("inbox.context")}</p>
      {loading && <div className="surface p-8 text-sm text-muted-foreground" aria-busy="true">{t("common.loading")}</div>}
      {error && <div className="surface flex items-start gap-3 p-6 text-sm text-destructive" role="alert"><AlertTriangle className="size-4 shrink-0" /><div>{t("inbox.error")} <span className="block mt-1">{error.message}</span><button type="button" className="mt-3 underline" onClick={() => { changes.refetch(); addresses.refetch(); schedules.refetch(); reviews.refetch(); }}>{t("lookup.retry")}</button></div></div>}
      {!loading && !error && monitored.size === 0 && <div className="surface p-10 text-center"><Inbox className="mx-auto mb-3 size-6 text-primary"/><h2 className="font-serif text-xl text-ink">{t("inbox.emptyWatch")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("inbox.emptyWatchHint")}</p><Link to="/portfolio" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{t("nav.portfolio")} <ArrowUpRight className="size-3" /></Link></div>}
      {!loading && !error && monitored.size > 0 && filtered.length === 0 && <div className="surface p-10 text-center text-sm text-muted-foreground">{t("inbox.emptyFilter")}</div>}
      {!loading && !error && filtered.length > 0 && <div className="space-y-3">
        {filtered.map(({ test, result, addressId, review }) => {
          const key = `${test.test_id}:${addressId}`;
          const a = addressMap.get(addressId);
          const status = review?.status ?? "unreviewed";
          const note = drafts[key] ?? review?.note ?? "";
          const asOf = test.as_of_after ?? test.as_of ?? DEFAULT_AS_OF;
          return <article key={key} className="surface overflow-hidden border-border/80 bg-card">
            <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_230px] md:gap-8 md:p-6">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">{test.test_id} · {test.type.replaceAll("_", " ")}</span>{result?.conflict_flag_address_ids?.includes(addressId) && <span className="rounded border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] text-destructive">{t("inbox.conflict")}</span>}</div>
                <h2 className="font-serif text-xl leading-snug text-ink">{test.title}</h2>
                <div className="mt-2 text-sm text-muted-foreground">{a ? `${a.street_address}, ${a.legal_city ?? a.postal_city}` : addressId} <span className="ml-1 font-mono text-xs">{addressId}</span></div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{result?.before_status && <StatusBadge value={result.before_status} />}{result?.before_status && result?.after_status && <span>→</span>}{result?.after_status && <StatusBadge value={result.after_status} />}{(result?.before_status || result?.after_status) && <span>·</span>}<span>{t("inbox.asOf")} {asOf}</span></div>
                <Link to="/" search={{ address: addressId, as_of: asOf }} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{t("inbox.openLookup")} <ArrowUpRight className="size-3" /></Link>
              </div>
              <div className="border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <label htmlFor={`state-${key}`} className="eyebrow mb-2 block">{t("inbox.reviewState")}</label>
                <select id={`state-${key}`} value={status} disabled={save.isPending} onChange={(e) => save.mutate({ changeId: test.test_id, addressId, status: e.target.value as ChangeReviewStatus, note })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink">{STATES.map((s) => <option key={s} value={s}>{t(`inbox.${s}`)}</option>)}</select>
                <button type="button" onClick={() => setEditing(editing === key ? null : key)} className="mt-3 text-xs text-primary hover:underline">{review?.note ? t("inbox.editNote") : t("inbox.addNote")}</button>
                {editing === key && <div className="mt-2"><label htmlFor={`note-${key}`} className="sr-only">{t("inbox.note")}</label><textarea id={`note-${key}`} value={note} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} maxLength={2000} rows={3} className="w-full rounded-md border border-border bg-background p-2 text-sm text-ink" /><button type="button" disabled={save.isPending} onClick={() => save.mutate({ changeId: test.test_id, addressId, status, note }, { onSuccess: () => setEditing(null) })} className="mt-2 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{t("inbox.saveNote")}</button></div>}
                {!editing && review?.note && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{review.note}</p>}
                {review?.updated_at && <div className="mt-3 font-mono text-[10px] text-muted-foreground">{t("inbox.updated")} {new Date(review.updated_at).toLocaleString()}</div>}
                {save.isError && <p role="alert" className="mt-2 text-xs text-destructive">{save.error.message}</p>}
              </div>
            </div>
          </article>;
        })}
      </div>}
      {!loading && !error && <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3" />{t("inbox.refresh")}</p>}
    </>}
  </main>;
}