import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getCiteClient } from "@/lib/cite/client";
import { PageHeader } from "@/components/cite/layout";
import { CitationPanel } from "@/components/cite/rule";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/cite/labels";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Cite" },
      { name: "description", content: "Watch Cite turn a legal source document into structured, validated, cited rules." },
      { property: "og:title", content: "Pipeline — Cite" },
      { property: "og:description", content: "Live extract demo: source text to structured rules, with schema validation and verbatim citations." },
    ],
  }),
  component: PipelinePage,
});

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
      setDocId(docs[0]!.doc_id);
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
  const run = useMutation({ mutationFn: (id: string) => client.extract(id) });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("pipeline.eyebrow")} title={t("pipeline.title")}>
        {t("pipeline.lede")}
      </PageHeader>

      <div className="surface fade-up space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                client.mode === "live"
                  ? "border-applies/30 bg-applies-soft text-applies"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              {client.mode === "live" ? t("pipeline.liveCorpus") : t("pipeline.demoDocs")}
            </span>
            {docsQuery.isSuccess && (
              <span className="font-mono text-xs text-muted-foreground">
                {docs.length} {t("pipeline.docsCount")}
              </span>
            )}
          </div>
          {client.mode === "live" && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter D001, California…"
              className="w-full max-w-xs rounded-md border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-ring sm:w-56"
            />
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
            {t("pipeline.docsError")} {(docsQuery.error as Error).message}
          </div>
        )}

        {docsQuery.isSuccess && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="eyebrow">{t("pipeline.sourceDoc")}</span>
              <select
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                className="mt-1 w-full rounded-md border bg-card px-3 py-2 text-ink outline-none focus:border-ring"
              >
                {filtered.map((d) => (
                  <option key={d.doc_id} value={d.doc_id}>
                    {d.doc_id} — {d.title} ({d.jurisdiction})
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => run.mutate(docId)}
              disabled={!docId || run.isPending || !filtered.length}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-60"
            >
              {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {run.isPending ? t("pipeline.running") : t("pipeline.run")}
            </button>
          </div>
        )}

        {selected && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 font-mono text-[11px] text-muted-foreground">
            <span>{selected.doc_id}</span>
            {selected.retrieved_at && <span>retrieved {selected.retrieved_at}</span>}
            {selected.chars != null && <span>{selected.chars.toLocaleString()} chars</span>}
            {selected.source_url && (
              <a href={selected.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                source URL
              </a>
            )}
          </div>
        )}
      </div>

      {run.isPending && (
        <div className="mt-8 space-y-4 fade-up" aria-busy="true">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            {t("pipeline.running")} {docId}
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
        <div className="mt-8 space-y-2 fade-up">
          {run.data.source && (
            <div className="font-mono text-xs text-muted-foreground">
              {t("pipeline.via")} <span className="text-ink">{run.data.source}</span>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="eyebrow mb-2">{t("pipeline.stepSource")}</h2>
              <div className="surface max-h-80 overflow-auto p-4 font-serif text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
                {run.data.source_text || "—"}
              </div>
              <h2 className="eyebrow mb-2 mt-6">{t("pipeline.stepValidation")}</h2>
              <ul className="surface divide-y">
                {run.data.validation.map((c) => (
                  <li key={c.check} className="flex gap-3 px-4 py-2.5 text-sm">
                    {c.passed ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-applies" />
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
            </section>
            <section>
              <h2 className="eyebrow mb-2">
                {t("pipeline.stepRules")} ({run.data.rules.length})
              </h2>
              <div className="space-y-4">
                {run.data.rules.length === 0 ? (
                  <p className="surface px-4 py-8 text-center text-sm text-muted-foreground">
                    No rules extracted from this document.
                  </p>
                ) : (
                  run.data.rules.map((r) => (
                    <div key={r.team_rule_id} className="surface p-4">
                      <div className="font-mono text-xs text-muted-foreground">{r.team_rule_id}</div>
                      <div className="mt-1 font-medium text-ink">{r.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {CATEGORY_LABEL[r.category]} · {r.level} · {r.jurisdiction} · {STATUS_LABEL[r.status]}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{r.requirement}</p>
                      <div className="mt-3">
                        <CitationPanel rule={r} />
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
