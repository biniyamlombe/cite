import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { getCiteClient } from "@/lib/cite/client";
import { PageHeader } from "@/components/cite/layout";
import { ChangeImpactCard } from "@/components/cite/changes";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "Change Radar — Cite" },
      { name: "description", content: "Which regulatory changes affect which properties, and when." },
      { property: "og:title", content: "Change Radar — Cite" },
      { property: "og:description", content: "What will change, when, and which properties will be affected." },
    ],
  }),
  component: ChangesPage,
});

function ChangesPage() {
  const client = getCiteClient();
  const changes = useQuery({ queryKey: ["changes"], queryFn: () => client.changes() });
  const addrs = useQuery({ queryKey: ["addresses", "", 500], queryFn: () => client.addresses("", 500) });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Module C · Change tests" title="Change Radar">
        Not only “what applies today?” — but what will change, when, and which properties will be affected.
      </PageHeader>
      {changes.isPending && <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="surface h-56 animate-pulse" />)}</div>}
      {changes.isError && <div className="surface p-5 text-sm">Could not load change tests. {(changes.error as Error).message}</div>}
      {changes.data && (
        <div className="space-y-5">
          {changes.data.tests.map((t) => (
            <ChangeImpactCard key={t.test_id} test={t} result={changes.data.results[t.test_id]} addresses={addrs.data ?? []} />
          ))}
          <article className="rounded-lg border border-dashed p-5 sm:p-6 opacity-70">
            <div className="eyebrow flex items-center gap-1.5"><Clock className="size-3" /> T6 · Upcoming</div>
            <h3 className="mt-1.5 font-serif text-xl text-ink">Hour-16 Cambridge ordinance</h3>
            <p className="mt-1 text-sm text-muted-foreground">Awaiting corpus release. No results until the source document is published.</p>
          </article>
        </div>
      )}
    </div>
  );
}
