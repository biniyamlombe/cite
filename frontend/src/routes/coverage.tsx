import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCiteClient } from "@/lib/cite/client";
import { CATEGORY_LABEL } from "@/lib/cite/labels";
import { PageHeader } from "@/components/cite/layout";
import type { Category } from "@/lib/cite/types";

export const Route = createFileRoute("/coverage")({
  head: () => ({
    meta: [
      { title: "Coverage — Cite" },
      { name: "description", content: "Which jurisdictions and topics the Cite rule catalog covers, and where the gaps are." },
      { property: "og:title", content: "Coverage — Cite" },
      { property: "og:description", content: "Jurisdiction and topic coverage of the rule catalog." },
    ],
  }),
  component: CoveragePage,
});

const CATS = Object.keys(CATEGORY_LABEL) as Category[];

function CoveragePage() {
  // Display-only grouping of the catalog as returned; no applicability is decided here.
  const q = useQuery({ queryKey: ["rules"], queryFn: () => getCiteClient().rules() });
  const byJur = new Map<string, { level: string; cats: Map<Category, number> }>();
  for (const r of q.data ?? []) {
    const e = byJur.get(r.jurisdiction) ?? { level: r.level, cats: new Map() };
    e.cats.set(r.category, (e.cats.get(r.category) ?? 0) + 1);
    byJur.set(r.jurisdiction, e);
  }
  const rows = [...byJur.entries()].sort((a, b) => (a[1].level === b[1].level ? a[0].localeCompare(b[0]) : a[1].level === "state" ? -1 : 1));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Corpus" title="Jurisdiction coverage">
        Filled cells show how many rules the catalog holds for that place and topic. Empty cells are gaps.
      </PageHeader>
      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {rows.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Jurisdiction</th>
                {CATS.map((c) => <th key={c} className="px-3 py-2 font-medium">{CATEGORY_LABEL[c]}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([j, e]) => (
                <tr key={j} className="border-t">
                  <td className="px-3 py-2"><span className="text-ink">{j}</span> <span className="font-mono text-[10px] uppercase text-muted-foreground">{e.level}</span></td>
                  {CATS.map((c) => {
                    const n = e.cats.get(c) ?? 0;
                    return (
                      <td key={c} className="px-3 py-2 text-center">
                        {n ? <span className="inline-block min-w-7 rounded bg-applies-soft px-2 py-0.5 font-mono text-xs text-applies">{n}</span>
                           : <span className="font-mono text-xs text-muted-foreground/50">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
