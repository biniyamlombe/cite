import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getCiteClient } from "@/lib/cite/client";
import { PageHeader } from "@/components/cite/layout";
import { CitationPanel } from "@/components/cite/rule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline · Cite" },
      { name: "description", content: "Watch Cite turn a legal source document into structured, validated, cited rules." },
      { property: "og:title", content: "Pipeline · Cite" },
      { property: "og:description", content: "Live extract demo: source text to structured rules, with schema validation and verbatim citations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

const DEMO_DOC_HINTS = ["D069", "D001", "D002"];

function ExtractStages({ pending, done }: { pending: boolean; done: boolean }) {
  const t = useT();
  const stages = [
    { key: "source", label: t("pipeline.stageSource") },
    { key: "validate", label: t("pipeline.stageValidate") },
    { key: "rules", label: t("pipeline.stageRules") },
  ] as const;
  // While pending, cycle visual emphasis; when done, all complete.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 900);
    return () => window.clearInterval(id);
  }, [pending]);
  const active = pending ? tick % 3 : -1;

  const statusLabel = pending
    ? stages[active]?.label ?? t("pipeline.running")
    : done
      ? t("pipeline.stepRules")
      : t("pipeline.empty");

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {statusLabel}
      </p>
      <ol className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label={t("pipeline.title")}>
        {stages.map((s, i) => {
          const complete = done || (pending && i < active);
          const current = pending && i === active;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden="true">→</span>}
              <div
                aria-current={current ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200",
                  complete && "border-applies/30 bg-applies-soft text-applies",
                  current && "border-ring bg-accent text-ink stage-pulse",
                  !complete && !current && "bg-card text-muted-foreground",
                )}
              >
                {complete ? (
                  <CheckCircle2 aria-hidden="true" className="size-3.5 stage-check" />
                ) : current ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <span className="font-mono text-[11px] tabular-nums">{i + 1}</span>
                )}
                {s.label}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PipelinePage() {
  const t = useT();
  const client = getCiteClient();
  const docsQuery = useQuery({
    queryKey: ["corpus-docs", client.mode],
    queryFn: () => client.corpusDocs(),
  });
  const docs = docsQuery.data ?? [];
  const [docId, setDocId] = useState("");
  const [filter, setFilter] = useState("");
  const [hintApplied, setHintApplied] = useState(false);

  useEffect(() => {
    if (!docs.length) return;
    if (!docId || !docs.some((d) => d.doc_id === docId)) {
      const preferred = DEMO_DOC_HINTS.map((id) => docs.find((d) => d.doc_id === id)).find(Boolean);
      setDocId(preferred?.doc_id ?? docs[0]!.doc_id);
      if (preferred) setHintApplied(true);
    }
  }, [docs, docId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.doc_id, d.title, d.jurisdiction].some((v) => v.toLowerCase().includes(q)),
    );
  }, [docs, filter]);

  const selected = docs.find((d) => d.doc_id === docId);
  const demoHint = docs.find((d) => DEMO_DOC_HINTS.includes(d.doc_id));
  const run = useMutation({ mutationFn: (id: string) => client.extract(id) });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("pipeline.eyebrow")} title={t("pipeline.title")}>
        {t("pipeline.lede")}
      </PageHeader>

      <div className="bezel fade-up">
        <div className="space-y-4 rounded-[calc(var(--radius-xl)-2px)] border border-border/60 bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {client.mode === "live" ? (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("pipeline.filter")}
                name="corpus-filter"
                autoComplete="off"
                spellCheck={false}
                aria-label={t("pipeline.filter")}
                className="w-full max-w-xs rounded-full border border-border/80 bg-paper/80 px-3.5 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-ring focus-visible:outline-none sm:w-56"
              />
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("pipeline.demoDocs")}
              </span>
            )}
            {demoHint && (
              <button
                type="button"
                onClick={() => {
                  setDocId(demoHint.doc_id);
                  setHintApplied(true);
                }}
                className="rounded-full border border-border/80 px-3 py-1.5 font-mono text-[11px] text-primary transition-colors hover:bg-accent"
              >
                {t("pipeline.tryThis")} {demoHint.doc_id}
                {hintApplied && docId === demoHint.doc_id ? " ·" : ""}
              </button>
            )}
          </div>

          {docsQuery.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              {t("pipeline.loadingDocs")}
            </div>
          )}

          {docsQuery.isError && (
            <div className="flex gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {t("pipeline.docsError")}
            </div>
          )}

          {docsQuery.isSuccess && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("pipeline.sourceDoc")}
                </span>
                <select
                  value={docId}
                  onChange={(e) => {
                    setDocId(e.target.value);
                    setHintApplied(false);
                  }}
                  className="mt-1.5 w-full rounded-xl border border-border/80 bg-paper/80 px-3 py-2.5 text-ink outline-none focus:border-ring"
                >
                  {filtered.map((d) => (
                    <option key={d.doc_id} value={d.doc_id}>
                      {d.doc_id} · {d.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => run.mutate(docId)}
                disabled={!docId || run.isPending || !filtered.length}
                className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-[transform,background-color] duration-200 hover:bg-primary/92 active:scale-[0.98] disabled:opacity-60"
              >
                {run.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-4" />}
                {run.isPending ? t("pipeline.running") : t("pipeline.run")}
              </button>
            </div>
          )}

          {selected?.source_url && (
            <a
              href={selected.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-mono text-[11px] text-primary hover:underline"
            >
              {selected.doc_id} · {t("rule.source").toLowerCase()}
            </a>
          )}
        </div>
      </div>

      {run.isPending && (
        <div className="mt-8 space-y-5 fade-up" aria-busy="true">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              {t("pipeline.running")} {docId}
            </div>
            <ExtractStages pending done={false} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="skeleton-shimmer h-64 rounded-lg" />
            <div className="skeleton-shimmer h-64 rounded-lg" />
          </div>
        </div>
      )}

      {run.isError && (
        <div className="surface mt-6 flex gap-3 p-5 fade-up">
          <AlertCircle className="size-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <div className="font-medium text-ink">{t("pipeline.failed")}</div>
            <p className="mt-1 text-muted-foreground">{(run.error as Error).message}</p>
          </div>
        </div>
      )}

      {!run.data && !run.isPending && !run.isError && docsQuery.isSuccess && (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t("pipeline.empty")}</p>
      )}

      {run.data && (
        <div className="mt-8 space-y-5 fade-up">
          <ExtractStages pending={false} done />
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-5">
              <div>
                <h2 className="font-serif text-lg text-ink">{t("pipeline.stepSource")}</h2>
                <div className="surface mt-2 max-h-72 overflow-auto p-4 font-serif text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
                  {run.data.source_text || "—"}
                </div>
              </div>
              <div>
                <h2 className="font-serif text-lg text-ink">{t("pipeline.stepValidation")}</h2>
                <ul className="surface mt-2 divide-y">
                  {run.data.validation.map((c) => (
                    <li key={c.check} className="flex gap-3 px-4 py-2.5 text-sm">
                      {c.passed ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-applies stage-check" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-conflict" />
                      )}
                      <div>
                        <div className="font-medium text-ink">{c.check}</div>
                        <div className="text-muted-foreground">{c.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <section>
              <h2 className="font-serif text-lg text-ink">
                {t("pipeline.stepRules")}
                <span className="ml-2 font-mono text-sm text-muted-foreground">{run.data.rules.length}</span>
              </h2>
              <div className="mt-2 space-y-3">
                {run.data.rules.length === 0 ? (
                  <p className="surface px-4 py-8 text-center text-sm text-muted-foreground">{t("pipeline.noRules")}</p>
                ) : (
                  run.data.rules.map((r, i) => (
                    <div key={r.team_rule_id} className="surface p-4">
                      <div className="font-medium text-ink">{r.title}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {r.team_rule_id} · {r.jurisdiction}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.requirement}</p>
                      <div className="mt-3">
                        <CitationPanel rule={r} emphasize={i === 0} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
