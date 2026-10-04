import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCiteClient } from "@/lib/cite/client";
import { CATEGORY_ORDER } from "@/lib/cite/labels";
import { useT, useTx } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import type { Category } from "@/lib/cite/types";

export const Route = createFileRoute("/coverage")({
  head: () => ({
    meta: [
      { title: "Coverage — Cite" },
      { name: "description", content: "Which jurisdictions and topics the Cite rule catalog covers, and where the gaps are." },
      { property: "og:title", content: "Coverage — Cite" },
      { property: "og:description", content: "Jurisdiction and topic coverage of the rule catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoveragePage,
});

function CoveragePage() {
  const t = useT();
  const tx = useTx();
  // Display-only grouping of the catalog as returned; no applicability is decided here.
  const q = useQuery({ queryKey: ["rules"], queryFn: () => getCiteClient().rules() });
  const byJur = new Map<string, { level: string; cats: Map<Category, number> }>();
  for (const r of q.data ?? []) {
    const e = byJur.get(r.jurisdiction) ?? { level: r.level, cats: new Map() };
    e.cats.set(r.category, (e.cats.get(r.category) ?? 0) + 1);
    byJur.set(r.jurisdiction, e);
  }
  const rows = [...byJur.entries()].sort((a, b) =>
    a[1].level === b[1].level ? a[0].localeCompare(b[0]) : a[1].level === "state" ? -1 : 1,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("coverage.eyebrow")} title={t("coverage.title")}>
        {t("coverage.lede")}
      </PageHeader>
      <p className="mt-2 text-sm text-muted-foreground">{t("coverage.legend")}</p>

      {q.isError && <p role="alert" className="mt-8">{t("monitor.unavailable")} <button className="underline" onClick={() => void q.refetch()}>{t("lookup.retry")}</button></p>}
      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>}

      {rows.length > 0 && (
        <div className="surface mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">{t("coverage.col.jurisdiction")}</th>
                {CATEGORY_ORDER.map((c) => (
                  <th key={c} className="px-3 py-2.5 font-medium">
                    {tx(`category.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([j, e]) => (
                <tr key={j} className="hover:bg-secondary/30">
                  <td className="px-3 py-2.5">
                    <span className="text-ink">{j}</span>{" "}
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {tx(`level.${e.level}`, e.level)}
                    </span>
                  </td>
                  {CATEGORY_ORDER.map((c) => {
                    const n = e.cats.get(c) ?? 0;
                    return (
                      <td key={c} className="px-3 py-2.5 text-center">
                        {n ? (
                          <span className="inline-block min-w-7 rounded bg-applies-soft px-2 py-0.5 font-mono text-xs text-applies">
                            {n}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground/50">—</span>
                        )}
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
