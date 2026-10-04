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
      {
        name: "description",
        content: "Watch Cite turn a legal source document into structured, validated, cited rules.",
      },
      { property: "og:title", content: "Pipeline · Cite" },
      {
        property: "og:description",
        content: "Turn a legal source document into structured, validated rules with citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

/** Prefer these docs for demos; first match wins for both default select and hint button. */
const DEMO_DOC_HINTS = ["D001", "D069", "D002"];

function pickDemoDoc<T extends { doc_id: string }>(docs: T[]) {
  return DEMO_DOC_HINTS.map((id) => docs.find((d) => d.doc_id === id)).find(Boolean);
}

/** Map legacy/internal extract check names to user-facing labels. */
function publicCheckLabel(check: string): string {
  const map: Record<string, string> = {
    "Schema + Zod/Ajv": "Schema validation",
    "Schema validation": "Schema validation",
    "Verbatim quoted span in corpus": "Quotation matches source",
    "Quotation matches source": "Quotation matches source",
    "Source document loaded": "Source document loaded",
  };
  return map[check] ?? check;
}

function publicCheckDetail(detail: string): string {
  return detail
    .replace(/\bZod\/Ajv\b/gi, "schema")
    .replace(/\bspan\(s\)\b/gi, "quotation(s)")
    .replace(/\bcorpus document\b/gi, "source document")
    .replace(/\bcorpus\b/gi, "source")
    .replace(/\s*\(\d+\s*chars? shown\)/gi, "");
}

function ExtractStages({ pending, done }: { pending: boolean; done: boolean }) {
  const t = useT();
  const stages = [
    { key: "source", label: t("pipeline.stageSource") },
    { key: "validate", label: t("pipeline.stageValidate") },
    { key: "rules", label: t("pipeline.stageRules") },
  ] as const;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 900);
    return () => window.clearInterval(id);
  }, [pending]);
  const active = pending ? tick % 3 : -1;

  const statusLabel = pending
    ? (stages[active]?.label ?? t("pipeline.running"))
    : done
      ? t("pipeline.stepRules")
      : t("pipeline.empty");

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {statusLabel}
      </p>
      <ol className="flex flex-wrap items-center gap-2" aria-label={t("pipeline.title")}>
        {stages.map((s, i) => {
          const complete = done || (pending && i < active);
          const current = pending && i === active;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden="true">
                  →
                </span>
              )}
              <div
                aria-current={current ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors duration-200",
                  complete && "border-applies/30 bg-applies-soft text-applies",
                  current && "border-ring bg-accent text-ink stage-pulse",
                  !complete && !current && "border-border/80 bg-card text-muted-foreground",
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

  useEffect(() => {
    if (!docs.length) return;
    if (!docId || !docs.some((d) => d.doc_id === docId)) {
      const preferred = pickDemoDoc(docs);
      setDocId(preferred?.doc_id ?? docs[0]!.doc_id);
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
  const demoHint = pickDemoDoc(docs);
  const run = useMutation({ mutationFn: (id: string) => client.extract(id) });

  const validationPass = run.data?.validation.filter((c) => c.passed).length ?? 0;
  const validationTotal = run.data?.validation.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("pipeline.eyebrow")} title={t("pipeline.title")}>
        {t("pipeline.lede")}
      </PageHeader>

      <div className="fade-up mb-6">
        <ExtractStages pending={run.isPending} done={Boolean(run.data)} />
      </div>

      <section
        className="fade-up border-b border-border/70 pb-6"
        aria-labelledby="pipeline-controls"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="pipeline-controls" className="font-serif text-xl tracking-[-0.02em] text-ink">
            {t("pipeline.sourceDoc")}
          </h2>
          {demoHint && (
            <button
              type="button"
              onClick={() => setDocId(demoHint.doc_id)}
              className="font-mono text-[11px] text-primary transition-colors hover:underline"
            >
              {t("pipeline.tryThis")} {demoHint.doc_id}
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {client.mode === "live" && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("pipeline.filter")}
              name="corpus-filter"
              autoComplete="off"
              spellCheck={false}
              aria-label={t("pipeline.filter")}
              className="w-full max-w-sm border border-border/80 bg-card px-3 py-2 text-sm text-ink outline-none transition-[border-color] focus:border-ring focus-visible:outline-none"
            />
          )}

          {client.mode !== "live" && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("pipeline.demoDocs")}
            </p>
          )}

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
                <select
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  className="w-full border border-border/80 bg-card px-3 py-2.5 text-ink outline-none focus:border-ring"
                >
                  {filtered.length === 0 ? (
                    <option value="">{t("pipeline.filterEmpty")}</option>
                  ) : (
                    filtered.map((d) => (
                      <option key={d.doc_id} value={d.doc_id}>
                        {d.doc_id} · {d.title}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={() => run.mutate(docId)}
                disabled={!docId || run.isPending || !filtered.length}
                className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {run.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
                {run.isPending ? t("pipeline.running") : t("pipeline.run")}
              </button>
            </div>
          )}

          {docsQuery.isSuccess && (
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {filtered.length} {t("pipeline.docsCount")}
              {selected?.jurisdiction ? ` · ${selected.jurisdiction}` : ""}
            </p>
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
      </section>

      {run.isPending && (
        <div className="mt-8 space-y-5 fade-up" aria-busy="true">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            {t("pipeline.running")} {docId}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="skeleton-shimmer h-64 rounded-md" />
            <div className="skeleton-shimmer h-64 rounded-md" />
          </div>
        </div>
      )}

      {run.isError && (
        <div className="mt-8 flex gap-3 border border-border/80 px-4 py-5 fade-up">
          <AlertCircle className="size-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <div className="font-medium text-ink">{t("pipeline.failed")}</div>
            <p className="mt-1 text-muted-foreground">{(run.error as Error).message}</p>
          </div>
        </div>
      )}

      {!run.data && !run.isPending && !run.isError && docsQuery.isSuccess && (
        <div className="mt-10 border border-dashed border-border/80 px-4 py-8 text-center">
          <p className="text-sm text-ink">{t("pipeline.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("pipeline.emptyHint")}</p>
        </div>
      )}

      {run.data && (
        <div className="mt-10 space-y-10 fade-up">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {t("pipeline.summary")
              .replace("{rules}", String(run.data.rules.length))
              .replace("{pass}", String(validationPass))
              .replace("{total}", String(validationTotal))}
          </p>

          <div className="grid gap-10 lg:grid-cols-2">
            <section aria-labelledby="pipeline-source">
              <h2
                id="pipeline-source"
                className="border-b border-border/70 pb-2 font-serif text-xl tracking-[-0.02em] text-ink"
              >
                {t("pipeline.stepSource")}
              </h2>
              <div className="mt-3 max-h-72 overflow-auto border border-border/80 bg-card/50 px-4 py-3 font-serif text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
                {run.data.source_text || "—"}
              </div>

              <h2
                id="pipeline-validation"
                className="mt-8 border-b border-border/70 pb-2 font-serif text-xl tracking-[-0.02em] text-ink"
              >
                {t("pipeline.stepValidation")}
                <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground">
                  {validationPass}/{validationTotal}
                </span>
              </h2>
              <ul className="mt-2 divide-y divide-border/70">
                {run.data.validation.map((c) => {
                  const label = publicCheckLabel(c.check);
                  const detail = publicCheckDetail(c.detail);
                  return (
                    <li key={c.check} className="flex gap-3 py-2.5 text-sm">
                      {c.passed ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-applies stage-check" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-conflict" />
                      )}
                      <div>
                        <div className="font-medium text-ink">{label}</div>
                        <div className="text-muted-foreground">{detail}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="pipeline-rules">
              <h2
                id="pipeline-rules"
                className="border-b border-border/70 pb-2 font-serif text-xl tracking-[-0.02em] text-ink"
              >
                {t("pipeline.stepRules")}
                <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground">
                  {run.data.rules.length}
                </span>
              </h2>
              <div className="mt-2 space-y-0 divide-y divide-border/70">
                {run.data.rules.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("pipeline.noRules")}
                  </p>
                ) : (
                  run.data.rules.map((r, i) => (
                    <div key={r.team_rule_id} className="py-4">
                      <div className="font-medium text-ink">{r.title}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {r.team_rule_id} · {r.jurisdiction}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {r.requirement}
                      </p>
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
