import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Download, ExternalLink } from "lucide-react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { downloadText } from "@/lib/cite/export";
import { PageHeader } from "@/components/cite/layout";
import { fmtDate } from "@/lib/cite/labels";

export const Route = createFileRoute("/sources")({
  validateSearch: z.object({ address: z.string().optional(), as_of: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Source documents — Cite" },
      { name: "description", content: "Download the source documents and quotations behind a property determination." },
      { property: "og:title", content: "Source documents — Cite" },
      { property: "og:description", content: "Every source behind a determination, ready to download." },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  const s = Route.useSearch();
  const addressId = s.address ?? "A0001";
  const asOf = s.as_of ?? DEFAULT_AS_OF;
  const q = useQuery({ queryKey: ["lookup", addressId, asOf], queryFn: () => getCiteClient().lookup(addressId, asOf) });
  const rules = (q.data?.results ?? []).flatMap((r) => (r.rule ? [{ id: r.team_rule_id, result: r.result, rule: r.rule }] : []));

  function manifest() {
    // Bundle exactly what the backend returned for this determination.
    const d = q.data!;
    downloadText(
      `cite-sources-${addressId}-${asOf}.json`,
      JSON.stringify({ address: d.address, as_of: d.as_of, disclaimer: d.disclaimer, sources: rules.map((r) => ({ team_rule_id: r.id, result: r.result, citation: r.rule.citation, source_url: r.rule.source_url, source_doc_id: r.rule.source_doc_id, retrieved_at: r.rule.retrieved_at, quoted_span: r.rule.quoted_span })) }, null, 2),
      "application/json",
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Download center" title="Source documents">
        Every source behind the determination for {addressId} as of {asOf}.{" "}
        <Link to="/" search={{ address: addressId, as_of: asOf }} className="text-primary hover:underline">Back to lookup</Link>
      </PageHeader>
      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="mt-8 text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <button onClick={manifest} className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            <Download className="size-4" /> Download source pack
          </button>
          <ul className="mt-6 divide-y rounded-lg border bg-card">
            {rules.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink">{r.rule.title}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.rule.citation} · doc {r.rule.source_doc_id ?? "—"} · retrieved {fmtDate(r.rule.retrieved_at)}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={r.rule.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
                      Open source <ExternalLink className="size-3.5" />
                    </a>
                    <button onClick={() => downloadText(`${r.id}-quote.txt`, `${r.rule.citation}\n${r.rule.source_url}\nRetrieved: ${r.rule.retrieved_at ?? "—"}\n\n"${r.rule.quoted_span}"\n`, "text/plain")}
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Quote .txt</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
