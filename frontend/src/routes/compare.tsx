import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { PageHeader } from "@/components/cite/layout";
import { AsOfDate } from "@/components/cite/property";
import { StatusBadge } from "@/components/cite/status";

const search = z.object({
  address: z.string().optional(),
  a: z.string().optional(),
  b: z.string().optional(),
});

export const Route = createFileRoute("/compare")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Compare dates · Cite" },
      {
        name: "description",
        content: "See side by side how the rules for a property differ between two dates.",
      },
      { property: "og:title", content: "Compare dates · Cite" },
      {
        property: "og:description",
        content: "Side-by-side rule status for one property at two dates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/compare" });
  const addressId = s.address ?? "A0003";
  const a = s.a ?? DEFAULT_AS_OF;
  const b = s.b ?? "2027-07-02";
  const c = getCiteClient();
  const addrs = useQuery({ queryKey: ["addresses", ""], queryFn: () => c.addresses("", 50) });
  const qa = useQuery({
    queryKey: ["lookup", addressId, a],
    queryFn: () => c.lookup(addressId, a),
  });
  const qb = useQuery({
    queryKey: ["lookup", addressId, b],
    queryFn: () => c.lookup(addressId, b),
  });

  // Pure side-by-side display of two backend responses; nothing is re-evaluated.
  const ids = [
    ...new Set(
      [...(qa.data?.results ?? []), ...(qb.data?.results ?? [])].map((r) => r.team_rule_id),
    ),
  ];
  const byA = new Map(qa.data?.results.map((r) => [r.team_rule_id, r]));
  const byB = new Map(qb.data?.results.map((r) => [r.team_rule_id, r]));
  const changed = ids.filter((id) => byA.get(id)?.result !== byB.get(id)?.result).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Time machine" title="Compare two dates">
        Pick a property and two dates to see which rules change between them.
      </PageHeader>
      <div className="mt-8 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="eyebrow mb-1 block">Property</span>
          <select
            value={addressId}
            onChange={(e) => nav({ search: (p) => ({ ...p, address: e.target.value }) })}
            className="rounded-md border bg-card px-3 py-2 text-sm"
          >
            {addrs.data?.map((x) => (
              <option key={x.address_id} value={x.address_id}>
                {x.address_id} · {x.street_address}, {x.postal_city}
              </option>
            ))}
          </select>
        </label>
        <AsOfDate
          value={a}
          onChange={(v) => nav({ search: (p) => ({ ...p, a: v }), replace: true })}
        />
        <span className="pb-2 text-muted-foreground">→</span>
        <AsOfDate
          value={b}
          onChange={(v) => nav({ search: (p) => ({ ...p, b: v }), replace: true })}
        />
      </div>
      {(qa.isLoading || qb.isLoading) && (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      )}
      {(qa.error || qb.error) && (
        <p className="mt-8 text-sm text-destructive">{((qa.error || qb.error) as Error).message}</p>
      )}
      {qa.data && qb.data && (
        <>
          <p className="mt-6 text-sm text-ink">
            {changed} of {ids.length} rules differ between {a} and {b}.
          </p>
          <table className="mt-3 w-full overflow-hidden rounded-lg border bg-card text-sm">
            <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Rule</th>
                <th className="px-3 py-2">{a}</th>
                <th className="px-3 py-2">{b}</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const ra = byA.get(id),
                  rb = byB.get(id);
                const diff = ra?.result !== rb?.result;
                return (
                  <tr key={id} className={`border-t ${diff ? "bg-unknown-soft/60" : ""}`}>
                    <td className="px-3 py-2">
                      {(ra ?? rb)?.rule?.title ?? id}
                      <div className="font-mono text-[11px] text-muted-foreground">{id}</div>
                    </td>
                    <td className="px-3 py-2">{ra ? <StatusBadge value={ra.result} /> : "—"}</td>
                    <td className="px-3 py-2">{rb ? <StatusBadge value={rb.result} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Link
            to="/"
            search={{ address: addressId, as_of: b }}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Open full lookup at {b} →
          </Link>
        </>
      )}
    </div>
  );
}
