import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { getCiteClient } from "@/lib/cite/client";
import { MOCK_EXTRACT_DOCS } from "@/mocks/cite";
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
  const docs = MOCK_EXTRACT_DOCS;
  const [docId, setDocId] = useState(docs[0]?.doc_id ?? "");
  const run = useMutation({ mutationFn: (id: string) => getCiteClient().extract(id) });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Pipeline · Module A" title="From legal text to cited rules">
        AI can help structure regulation. Deterministic systems evaluate applicability. Evidence supports the conclusion. Pick a source document and run the extract step to see what comes out.
      </PageHeader>

      <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="eyebrow">Source document</span>
          <select value={docId} onChange={(e) => setDocId(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2 text-ink">
            {docs.map((d) => (
              <option key={d.doc_id} value={d.doc_id}>{d.doc_id} — {d.title} ({d.jurisdiction})</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => run.mutate(docId)}
          disabled={!docId || run.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run extract
        </button>
      </div>

      {run.isError && (
        <div className="surface mt-6 flex gap-3 p-5">
          <AlertCircle className="size-5 text-destructive" />
          <div className="text-sm"><div className="font-medium text-ink">Extract failed</div>{(run.error as Error).message}</div>
        </div>
      )}

      {!run.data && !run.isPending && !run.isError && (
        <p className="mt-8 text-center text-sm text-muted-foreground">No extract run yet. Choose a document and press Run extract.</p>
      )}

      {run.data && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2 fade-up">
          <section>
            <h2 className="eyebrow mb-2">1 · Source text</h2>
            <div className="surface max-h-80 overflow-auto p-4 font-serif text-[15px] leading-relaxed text-ink">{run.data.source_text}</div>
            <h2 className="eyebrow mb-2 mt-6">2 · Schema validation</h2>
            <ul className="surface divide-y">
              {run.data.validation.map((c) => (
                <li key={c.check} className="flex gap-3 px-4 py-2.5 text-sm">
                  {c.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-applies" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-conflict" />}
                  <div><div className="font-medium text-ink">{c.check}</div><div className="text-muted-foreground">{c.detail}</div></div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="eyebrow mb-2">3 · Structured rules ({run.data.rules.length})</h2>
            <div className="space-y-4">
              {run.data.rules.map((r) => (
                <div key={r.team_rule_id} className="surface p-4">
                  <div className="font-mono text-xs text-muted-foreground">{r.team_rule_id}</div>
                  <div className="mt-1 font-medium text-ink">{r.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABEL[r.category]} · {r.level} · {r.jurisdiction} · {STATUS_LABEL[r.status]}</div>
                  <p className="mt-2 text-sm">{r.requirement}</p>
                  <div className="mt-3"><CitationPanel rule={r} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
