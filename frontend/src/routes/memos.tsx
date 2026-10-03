import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { deleteMemo, listMemos } from "@/lib/cite/team";
import { downloadText, lookupToCsv } from "@/lib/cite/export";
import { PageHeader } from "@/components/cite/layout";

export const Route = createFileRoute("/memos")({
  head: () => ({
    meta: [
      { title: "Saved memos — Cite" },
      { name: "description", content: "Your saved regulatory applicability memos, kept for audit." },
      { property: "og:title", content: "Saved memos — Cite" },
      { property: "og:description", content: "Saved applicability memos for audit trails." },
    ],
  }),
  component: MemosPage,
});

function MemosPage() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["memos", user?.id], queryFn: listMemos, enabled: !!user });
  const del = useMutation({ mutationFn: deleteMemo, onSuccess: () => qc.invalidateQueries({ queryKey: ["memos"] }) });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Audit trail" title="Saved memos">
        Each memo keeps the results exactly as they were on the day you saved them.{" "}
        <Link to="/audit" className="text-primary hover:underline">View lookup history</Link>
      </PageHeader>
      {ready && !user && (
        <p className="mt-8 text-sm">
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your saved memos.
        </p>
      )}
      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="mt-8 text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && q.data.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No memos yet. Open a property and press “Save memo”.</p>
      )}
      <ul className="mt-8 divide-y rounded-lg border bg-card">
        {q.data?.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="font-medium text-ink">{m.title}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                saved {m.created_at.slice(0, 16).replace("T", " ")} · {m.snapshot.results?.length ?? 0} rules
              </div>
              {m.note && <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>}
            </div>
            <div className="flex gap-2">
              <Link to="/" search={{ address: m.address_id, as_of: m.as_of }}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Open</Link>
              <button onClick={() => downloadText(`cite-memo-${m.address_id}-${m.as_of}.csv`, lookupToCsv(m.snapshot))}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">CSV</button>
              <button onClick={() => del.mutate(m.id)} aria-label="Delete memo"
                className="rounded-md border px-2 py-1.5 text-muted-foreground hover:bg-secondary"><Trash2 className="size-4" /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
