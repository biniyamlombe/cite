import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { AsOfDate } from "@/components/cite/property";
import { StatusBadge } from "@/components/cite/status";

const search = z.object({
  mode: z.enum(["dates", "addresses"]).optional(),
  address: z.string().optional(),
  address2: z.string().optional(),
  a: z.string().optional(),
  b: z.string().optional(),
  as_of: z.string().optional(),
});

export const Route = createFileRoute("/compare")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Compare · Cite" },
      {
        name: "description",
        content: "Compare rules across two dates or two addresses side by side.",
      },
      { property: "og:title", content: "Compare · Cite" },
      {
        property: "og:description",
        content: "Side-by-side rule status for dates or addresses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const t = useT();
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/compare" });
  const mode = s.mode ?? "dates";
  const addressId = s.address ?? "A0003";
  const address2 = s.address2 ?? "A0016";
  const a = s.a ?? DEFAULT_AS_OF;
  const b = s.b ?? "2027-07-02";
  const asOf = s.as_of ?? DEFAULT_AS_OF;
  const c = getCiteClient();
  const addrs = useQuery({ queryKey: ["addresses", ""], queryFn: () => c.addresses("", 50) });

  const leftId = mode === "dates" ? addressId : addressId;
  const rightId = mode === "dates" ? addressId : address2;
  const leftAsOf = mode === "dates" ? a : asOf;
  const rightAsOf = mode === "dates" ? b : asOf;

  const qa = useQuery({
    queryKey: ["lookup", leftId, leftAsOf],
    queryFn: () => c.lookup(leftId, leftAsOf),
  });
  const qb = useQuery({
    queryKey: ["lookup", rightId, rightAsOf],
    queryFn: () => c.lookup(rightId, rightAsOf),
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

  const leftLabel = mode === "dates" ? a : leftId;
  const rightLabel = mode === "dates" ? b : rightId;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t("compare.eyebrow")} title={t("compare.title")}>
        {t("compare.lede")}
      </PageHeader>

      <div
        role="tablist"
        className="mt-8 inline-grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-secondary/50 p-1"
      >
        {(["dates", "addresses"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => void nav({ search: (p) => ({ ...p, mode: m }), replace: true })}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
              mode === m ? "bg-paper text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
            }`}
          >
            {m === "dates" ? t("compare.mode.dates") : t("compare.mode.addresses")}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        {mode === "dates" ? (
          <>
            <label className="text-sm">
              <span className="eyebrow mb-1 block">{t("compare.property")}</span>
              <select
                value={addressId}
                onChange={(e) =>
                  void nav({ search: (p) => ({ ...p, address: e.target.value }) })
                }
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
              onChange={(v) => void nav({ search: (p) => ({ ...p, a: v }), replace: true })}
            />
            <span className="pb-2 text-muted-foreground">→</span>
            <AsOfDate
              value={b}
              onChange={(v) => void nav({ search: (p) => ({ ...p, b: v }), replace: true })}
            />
          </>
        ) : (
          <>
            <label className="text-sm">
              <span className="eyebrow mb-1 block">{t("compare.addressA")}</span>
              <select
                value={addressId}
                onChange={(e) =>
                  void nav({ search: (p) => ({ ...p, address: e.target.value }) })
                }
                className="rounded-md border bg-card px-3 py-2 text-sm"
              >
                {addrs.data?.map((x) => (
                  <option key={x.address_id} value={x.address_id}>
                    {x.address_id} · {x.street_address}, {x.postal_city}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow mb-1 block">{t("compare.addressB")}</span>
              <select
                value={address2}
                onChange={(e) =>
                  void nav({ search: (p) => ({ ...p, address2: e.target.value }) })
                }
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
              value={asOf}
              onChange={(v) => void nav({ search: (p) => ({ ...p, as_of: v }), replace: true })}
            />
          </>
        )}
      </div>

      {(qa.isLoading || qb.isLoading) && (
        <p className="mt-8 text-sm text-muted-foreground">{t("compare.loading")}</p>
      )}
      {(qa.error || qb.error) && (
        <p className="mt-8 text-sm text-destructive">{((qa.error || qb.error) as Error).message}</p>
      )}
      {qa.data && qb.data && (
        <>
          <p className="mt-6 text-sm text-ink">
            {t("compare.diffSummary")
              .replace("{changed}", String(changed))
              .replace("{total}", String(ids.length))
              .replace("{left}", leftLabel)
              .replace("{right}", rightLabel)}
          </p>
          {mode === "addresses" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {qa.data.jurisdiction.city}, {qa.data.jurisdiction.state} ·{" "}
              {qb.data.jurisdiction.city}, {qb.data.jurisdiction.state}
            </p>
          )}
          <table className="mt-3 w-full overflow-hidden rounded-lg border bg-card text-sm">
            <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("compare.col.rule")}</th>
                <th className="px-3 py-2">{leftLabel}</th>
                <th className="px-3 py-2">{rightLabel}</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const ra = byA.get(id);
                const rb = byB.get(id);
                const diff = ra?.result !== rb?.result;
                return (
                  <tr key={id} className={`border-t ${diff ? "bg-unknown-soft/60" : ""}`}>
                    <td className="px-3 py-2">
                      {(ra ?? rb)?.rule?.title ?? id}
                      <div className="font-mono text-[11px] text-muted-foreground">{id}</div>
                      {(ra ?? rb)?.rule?.category ? (
                        <div className="text-[11px] text-muted-foreground">
                          {(ra ?? rb)?.rule?.category}
                        </div>
                      ) : null}
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
            search={{ address: rightId, as_of: rightAsOf }}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            {t("compare.openLookup").replace("{id}", rightId)}
          </Link>
        </>
      )}
    </div>
  );
}
