import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, ArrowUpRight, ClipboardList, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import {
  listCases,
  listCaseEvents,
  updateCase,
  type ReviewCase,
  type CaseStatus,
} from "@/lib/cite/cases";
import { PageHeader } from "@/components/cite/layout";
import { SignInCard } from "@/components/cite/sign-in-card";
import { ResultSummaryChips } from "@/components/cite/status";
import { EvidenceFreshness } from "@/components/cite/evidence-freshness";
import { SourceDependencies } from "@/components/cite/source-dependencies";
import { downloadText } from "@/lib/cite/export";
import { DISCLAIMER } from "@/lib/cite/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/workspace")({
  validateSearch: z.object({ case: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Decision workspace · Cite" },
      {
        name: "description",
        content: "Review property cases with saved evidence, assignments and a decision history.",
      },
      { property: "og:title", content: "Decision workspace · Cite" },
      {
        property: "og:description",
        content: "Review property cases with saved evidence, assignments and a decision history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

const STATUS: CaseStatus[] = ["open", "needs_counsel", "approved", "closed"];

function CaseEditor({ item }: { item: ReviewCase }) {
  const t = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    title: item.title,
    assignee: item.assignee,
    status: item.status,
    questions: item.questions,
    evidence_notes: item.evidence_notes,
  });
  useEffect(
    () =>
      setDraft({
        title: item.title,
        assignee: item.assignee,
        status: item.status,
        questions: item.questions,
        evidence_notes: item.evidence_notes,
      }),
    [item.id],
  );
  const events = useQuery({
    queryKey: ["case-events", item.id, user?.id],
    queryFn: () => listCaseEvents(item.id),
    enabled: !!user,
  });
  const save = useMutation({
    mutationFn: () => updateCase(item.id, draft),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["cases"] }),
        qc.invalidateQueries({ queryKey: ["case-events", item.id] }),
      ]);
      toast.success(t("workspace.saved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const dirty = Object.entries(draft).some(
    ([key, value]) => value !== item[key as keyof typeof draft],
  );
  const snapshot = item.snapshot;
  const exportPacket = () => {
    const lines = [
      "CITE / CASE PACKET",
      "",
      DISCLAIMER,
      "",
      `Case: ${item.title}`,
      `Property: ${snapshot.address.street_address}, ${snapshot.address.postal_city}, ${snapshot.address.state} ${snapshot.address.zip}`,
      `Property ID: ${item.address_id}`,
      `As of: ${item.as_of}`,
      `Captured: ${item.created_at}`,
      `Packet exported: ${new Date().toISOString()}`,
      `Review state (workflow only): ${item.status}`,
      `Assigned reviewer: ${item.assignee || "—"}`,
      `Year built: ${snapshot.address.year_built}`,
      `Units: ${snapshot.address.units}`,
      `Backend-resolved city: ${snapshot.jurisdiction.city}`,
      "",
      "OPEN QUESTIONS",
      item.questions || "—",
      "",
      "EVIDENCE NOTES",
      item.evidence_notes || "—",
      "",
      "BACKEND DETERMINATIONS AND ORIGINAL QUOTATIONS",
      ...snapshot.results.flatMap((r) => [
        "",
        `${r.team_rule_id} / ${r.result}${r.conflict_flag ? " / conflict flagged" : ""}`,
        `Title: ${r.rule?.title ?? "—"}`,
        `Explanation: ${r.explanation}`,
        `Citation: ${r.rule?.citation ?? "—"}`,
        `Quote: ${r.rule?.quoted_span ?? "—"}`,
        `Source: ${r.rule?.source_url ?? "—"}`,
        `Source document: ${r.rule?.source_doc_id ?? "—"}`,
        `Retrieved: ${r.rule?.retrieved_at ?? "unknown"}`,
      ]),
      "",
      "REVIEW HISTORY",
      ...(events.data ?? []).map((e) => `${e.created_at} · ${e.detail}`),
      "",
      DISCLAIMER,
    ];
    downloadText(
      `cite-case-${item.address_id}-${item.id}.txt`,
      lines.join("\n"),
      "text/plain;charset=utf-8",
    );
  };
  return (
    <div className="min-w-0 fade-up">
      <div className="border-b pb-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-primary">
            {item.address_id} · {item.as_of}
          </span>
          <Link
            to="/"
            search={{ address: item.address_id, as_of: item.as_of }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t("workspace.liveLookup")} <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <h2 className="mt-3 font-serif text-3xl text-ink">{item.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("workspace.snapshot")} · {new Date(item.created_at).toLocaleString()}
        </p>
        <button
          type="button"
          onClick={exportPacket}
          disabled={events.isPending || events.isError}
          className="mt-3 text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {t("packet.download")} ↓
        </button>
      </div>
      <div className="grid gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="min-w-0 space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink">
              {t("workspace.title")}
              <input
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2.5 outline-none focus:border-primary"
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              {t("workspace.owner")}
              <input
                maxLength={200}
                value={draft.assignee}
                onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
                placeholder={t("workspace.ownerPlaceholder")}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2.5 outline-none focus:border-primary"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-ink">
            {t("workspace.status")}
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as CaseStatus })}
              className="mt-2 block w-full rounded-md border bg-background px-3 py-2.5 outline-none focus:border-primary"
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {t(`workspace.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            {t("workspace.questions")}
            <textarea
              rows={4}
              value={draft.questions}
              onChange={(e) => setDraft({ ...draft, questions: e.target.value })}
              className="mt-2 block w-full resize-y rounded-md border bg-background px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            {t("workspace.evidenceNotes")}
            <textarea
              rows={4}
              value={draft.evidence_notes}
              onChange={(e) => setDraft({ ...draft, evidence_notes: e.target.value })}
              className="mt-2 block w-full resize-y rounded-md border bg-background px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
          <Button type="submit" disabled={!dirty || save.isPending}>
            <Save /> {save.isPending ? t("common.loading") : t("workspace.save")}
          </Button>
        </form>
        <aside className="space-y-7 border-t pt-7 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <section>
            <h3 className="eyebrow mb-3">{t("workspace.frozenEvidence")}</h3>
            <ResultSummaryChips results={snapshot.results ?? []} />
            <div className="mt-4">
              <EvidenceFreshness data={snapshot} capturedAt={item.created_at} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {snapshot.jurisdiction?.city}, {snapshot.jurisdiction?.state} ·{" "}
              {snapshot.results?.length ?? 0} {t("workspace.results")}
            </p>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto border-t pt-3">
              {(snapshot.results ?? [])
                .filter((r) => r.rule)
                .map((r) => (
                  <div key={r.team_rule_id} className="border-b pb-3 text-xs">
                    <p className="font-medium text-ink">{r.rule?.title}</p>
                    <p className="mt-1 text-muted-foreground">
                      {r.rule?.citation} · {r.result}
                    </p>
                    {r.rule?.source_url && (
                      <a
                        href={r.rule.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {t("workspace.source")} <ArrowUpRight className="size-3" />
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </section>
          <SourceDependencies snapshot={snapshot} />
          <section className="border-t pt-5">
            <h3 className="eyebrow mb-3">{t("workspace.history")}</h3>
            {events.isLoading && <Loader2 className="size-4 animate-spin" />}
            {events.isError && (
              <p className="text-sm text-destructive">{(events.error as Error).message}</p>
            )}
            <ol className="space-y-4 border-l pl-4">
              {events.data?.map((event) => (
                <li key={event.id} className="text-xs">
                  <div className="font-medium text-ink">{event.detail}</div>
                  <time className="mt-1 block text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Workspace() {
  const t = useT();
  const { user, ready } = useAuth();
  const { case: selectedId } = Route.useSearch();
  const cases = useQuery({ queryKey: ["cases", user?.id], queryFn: listCases, enabled: !!user });
  const selected = cases.data?.find((item) => item.id === selectedId) ?? cases.data?.[0];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("workspace.eyebrow")} title={t("workspace.heading")}>
        {t("workspace.lede")}
      </PageHeader>
      {ready && !user && <SignInCard messageKey="workspace.signin" />}
      {user && cases.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("common.loading")}
        </p>
      )}
      {user && cases.isError && (
        <p className="text-sm text-destructive">
          {(cases.error as Error).message}{" "}
          <Button variant="link" onClick={() => cases.refetch()}>
            {t("lookup.retry")}
          </Button>
        </p>
      )}
      {user && cases.data?.length === 0 && (
        <div className="border-t py-12 text-center">
          <ClipboardList className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-ink">{t("workspace.empty")}</p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/">
              <ArrowLeft />
              {t("memos.openLookup")}
            </Link>
          </Button>
        </div>
      )}
      {user && !!cases.data?.length && (
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label={t("workspace.cases")} className="border-t pt-4">
            <h2 className="eyebrow mb-4">
              {t("workspace.cases")} <span className="ml-2 text-primary">{cases.data.length}</span>
            </h2>
            <div className="space-y-1">
              {cases.data.map((item) => (
                <Link
                  key={item.id}
                  to="/workspace"
                  search={{ case: item.id }}
                  className={`block border-l-2 px-3 py-3 text-left transition-colors ${selected?.id === item.id ? "border-primary bg-secondary" : "border-transparent hover:bg-secondary/50"}`}
                >
                  <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                  <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                    {item.address_id} · {t(`workspace.${item.status}`)}
                  </span>
                </Link>
              ))}
            </div>
          </nav>
          {selected && <CaseEditor key={selected.id} item={selected} />}
        </div>
      )}
    </div>
  );
}
