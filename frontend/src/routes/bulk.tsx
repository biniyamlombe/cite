import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { downloadText, lookupToCsv } from "@/lib/cite/export";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { AsOfDate } from "@/components/cite/property";
import type { LookupResponse } from "@/lib/cite/types";

export const Route = createFileRoute("/bulk")({
  head: () => ({
    meta: [
      { title: "Bulk lookup — Cite" },
      { name: "description", content: "Check many rental properties at once and export the results." },
      { property: "og:title", content: "Bulk lookup — Cite" },
      { property: "og:description", content: "Applicability results for a whole list of addresses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkPage,
});

type Row = { input: string; data?: LookupResponse; error?: string };

function BulkPage() {
  const t = useT();
  const [text, setText] = useState("A0001\nA0003\nCambridge\n");
  const [asOf, setAsOf] = useState(DEFAULT_AS_OF);
  const run = useMutation({
    mutationFn: async (): Promise<Row[]> => {
      const c = getCiteClient();
      const inputs = text.split(/\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 200);
      return Promise.all(
        inputs.map(async (input): Promise<Row> => {
          try {
            const [hit] = await c.addresses(input, 1);
            if (!hit) return { input, error: t("bulk.error.none") };
            return { input, data: await c.lookup(hit.address_id, asOf) };
          } catch (e) {
            return { input, error: (e as Error).message };
          }
        }),
      );
    },
  });
  const ok = run.data?.filter((r) => r.data) ?? [];
  const count = (d: LookupResponse, v: string) => d.results.filter((r) => r.result === v).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("bulk.eyebrow")} title={t("bulk.title")}>
        {t("bulk.lede")}
      </PageHeader>
      <p className="mt-2 text-sm text-muted-foreground">{t("bulk.hint")}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-border/80 bg-paper/80 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-ring"
          aria-label={t("bulk.aria")}
        />
        <div className="flex flex-col gap-3">
          <AsOfDate value={asOf} onChange={setAsOf} />
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending}
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:bg-primary/92 active:scale-[0.98] disabled:opacity-60"
          >
            {run.isPending ? t("bulk.running") : t("bulk.run")}
          </button>
          {ok.length > 0 && (
            <button
              onClick={() =>
                downloadText(
                  `cite-bulk-${asOf}.csv`,
                  ok
                    .map((r, i) => {
                      const csv = lookupToCsv(r.data!);
                      return i === 0 ? csv : csv.split("\n").slice(1).join("\n");
                    })
                    .join("\n"),
                )
              }
              className="rounded-full border border-border/80 bg-paper/80 px-4 py-2.5 text-sm hover:bg-secondary"
            >
              {t("bulk.export")}
            </button>
          )}
        </div>
      </div>

      {run.data && (
        <div className="surface mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">{t("bulk.col.input")}</th>
                <th className="px-3 py-2.5">{t("bulk.col.property")}</th>
                <th className="px-3 py-2.5">{t("result.applies")}</th>
                <th className="px-3 py-2.5">{t("result.unknown")}</th>
                <th className="px-3 py-2.5">{t("portfolio.col.upcoming")}</th>
                <th className="px-3 py-2.5">{t("portfolio.col.conflicts")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {run.data.map((r, i) => (
                <tr key={i} className="hover:bg-secondary/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{r.input}</td>
                  {r.data ? (
                    <>
                      <td className="px-3 py-2.5">
                        {r.data.address.address_id} · {r.data.address.street_address}, {r.data.address.postal_city}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{count(r.data, "applies")}</td>
                      <td className="px-3 py-2.5 font-mono">{count(r.data, "unknown")}</td>
                      <td className="px-3 py-2.5 font-mono">
                        {count(r.data, "not_yet_effective") + count(r.data, "pending")}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {r.data.results.filter((x) => x.conflict_flag).length}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-3 py-2.5 text-destructive">
                      {r.error}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
