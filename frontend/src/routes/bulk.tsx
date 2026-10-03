import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { downloadText, lookupToCsv } from "@/lib/cite/export";
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
    ],
  }),
  component: BulkPage,
});

type Row = { input: string; data?: LookupResponse; error?: string };

function BulkPage() {
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
            if (!hit) return { input, error: "No matching property" };
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Many properties" title="Bulk lookup">
        Paste property IDs or addresses, one per line (up to 200).
      </PageHeader>
      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
          className="w-full rounded-md border bg-card px-3 py-2 font-mono text-sm" aria-label="Addresses" />
        <div className="flex flex-col gap-3">
          <AsOfDate value={asOf} onChange={setAsOf} />
          <button onClick={() => run.mutate()} disabled={run.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
            {run.isPending ? "Checking…" : "Run lookup"}
          </button>
          {ok.length > 0 && (
            <button onClick={() => downloadText(`cite-bulk-${asOf}.csv`, ok.map((r, i) => {
              const csv = lookupToCsv(r.data!);
              return i === 0 ? csv : csv.split("\n").slice(1).join("\n");
            }).join("\n"))} className="rounded-md border px-4 py-2 text-sm hover:bg-secondary">Export all CSV</button>
          )}
        </div>
      </div>
      {run.data && (
        <table className="mt-8 w-full border-collapse overflow-hidden rounded-lg border bg-card text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Input</th><th className="px-3 py-2">Property</th><th className="px-3 py-2">Applies</th><th className="px-3 py-2">Unknown</th><th className="px-3 py-2">Upcoming</th><th className="px-3 py-2">Conflicts</th></tr>
          </thead>
          <tbody>
            {run.data.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{r.input}</td>
                {r.data ? (
                  <>
                    <td className="px-3 py-2">{r.data.address.address_id} · {r.data.address.street_address}, {r.data.address.postal_city}</td>
                    <td className="px-3 py-2">{count(r.data, "applies")}</td>
                    <td className="px-3 py-2">{count(r.data, "unknown")}</td>
                    <td className="px-3 py-2">{count(r.data, "not_yet_effective") + count(r.data, "pending")}</td>
                    <td className="px-3 py-2">{r.data.results.filter((x) => x.conflict_flag).length}</td>
                  </>
                ) : (
                  <td colSpan={5} className="px-3 py-2 text-destructive">{r.error}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
