import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useMemo, useState } from "react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useLocale, useT, useTx, type StringKey } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { AsOfDate } from "@/components/cite/property";
import { StatusBadge } from "@/components/cite/status";
import { fmtDate } from "@/lib/cite/labels";

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

function addressOptionLabel(street: string, city: string) {
  return `${street}, ${city}`;
}

function ComparePage() {
  const t = useT();
  const tx = useTx();
  const { locale } = useLocale();
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/compare" });
  const mode = s.mode ?? "dates";
  const addressId = s.address ?? "A0003";
  const address2 = s.address2 ?? "A0016";
  const a = s.a ?? DEFAULT_AS_OF;
  const b = s.b ?? "2027-07-02";
  const asOf = s.as_of ?? DEFAULT_AS_OF;
  const [changedOnly, setChangedOnly] = useState(false);
  const c = getCiteClient();
  const addrs = useQuery({ queryKey: ["addresses", ""], queryFn: () => c.addresses("", 50) });

  const leftId = addressId;
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
  const rows = useMemo(() => {
    const ids = [
      ...new Set(
        [...(qa.data?.results ?? []), ...(qb.data?.results ?? [])].map((r) => r.team_rule_id),
      ),
    ];
    const byA = new Map(qa.data?.results.map((r) => [r.team_rule_id, r]));
    const byB = new Map(qb.data?.results.map((r) => [r.team_rule_id, r]));
    return ids
      .map((id) => {
        const ra = byA.get(id);
        const rb = byB.get(id);
        const rule = ra?.rule ?? rb?.rule;
        const diff = ra?.result !== rb?.result;
        return { id, ra, rb, rule, diff };
      })
      .sort((x, y) => Number(y.diff) - Number(x.diff));
  }, [qa.data, qb.data]);

  const changed = rows.filter((r) => r.diff).length;
  const visible = changedOnly ? rows.filter((r) => r.diff) : rows;

  const leftHeader =
    mode === "dates"
      ? fmtDate(a, locale)
      : (addrs.data?.find((x) => x.address_id === leftId)?.street_address ?? leftId);
  const rightHeader =
    mode === "dates"
      ? fmtDate(b, locale)
      : (addrs.data?.find((x) => x.address_id === rightId)?.street_address ?? rightId);

  const leftAddr = addrs.data?.find((x) => x.address_id === leftId);
  const rightAddr = addrs.data?.find((x) => x.address_id === rightId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
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
            <label className="min-w-[16rem] flex-1 text-sm">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("compare.property")}
              </span>
              <select
                value={addressId}
                onChange={(e) =>
                  void nav({ search: (p) => ({ ...p, address: e.target.value }) })
                }
                className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              >
                {addrs.data?.map((x) => (
                  <option key={x.address_id} value={x.address_id}>
                    {addressOptionLabel(x.street_address, x.postal_city)}
                  </option>
                ))}
              </select>
            </label>
            <AsOfDate
              value={a}
              onChange={(v) => void nav({ search: (p) => ({ ...p, a: v }), replace: true })}
            />
            <span className="pb-2 text-muted-foreground" aria-hidden>
              →
            </span>
            <AsOfDate
              value={b}
              onChange={(v) => void nav({ search: (p) => ({ ...p, b: v }), replace: true })}
            />
          </>
        ) : (
          <>
            <label className="min-w-[14rem] flex-1 text-sm">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("compare.addressA")}
              </span>
              <select
                value={addressId}
                onChange={(e) =>
                  void nav({ search: (p) => ({ ...p, address: e.target.value }) })
                }
                className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              >
                {addrs.data?.map((x) => (
                  <option key={x.address_id} value={x.address_id}>
                    {addressOptionLabel(x.street_address, x.postal_city)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[14rem] flex-1 text-sm">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("compare.addressB")}
              </span>
              <select
                value={address2}
                onChange={(e) =>
                  void nav({ search: (p) => ({ ...p, address2: e.target.value }) })
                }
                className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              >
                {addrs.data?.map((x) => (
                  <option key={x.address_id} value={x.address_id}>
                    {addressOptionLabel(x.street_address, x.postal_city)}
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
        <p className="mt-8 text-sm text-destructive" role="alert">
          {((qa.error || qb.error) as Error).message}
        </p>
      )}
      {qa.data && qb.data && (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-serif text-xl text-ink">
                {changed === 0
                  ? t("compare.diffNone")
                      .replace("{left}", leftHeader)
                      .replace("{right}", rightHeader)
                  : t("compare.diffSummary")
                      .replace("{changed}", String(changed))
                      .replace("{total}", String(rows.length))
                      .replace("{left}", leftHeader)
                      .replace("{right}", rightHeader)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "dates"
                  ? t("compare.hint.dates").replace(
                      "{place}",
                      leftAddr
                        ? `${leftAddr.street_address}, ${leftAddr.legal_city ?? leftAddr.postal_city}`
                        : leftId,
                    )
                  : t("compare.hint.addresses")
                      .replace(
                        "{a}",
                        leftAddr
                          ? `${leftAddr.street_address}, ${leftAddr.legal_city ?? leftAddr.postal_city}`
                          : leftId,
                      )
                      .replace(
                        "{b}",
                        rightAddr
                          ? `${rightAddr.street_address}, ${rightAddr.legal_city ?? rightAddr.postal_city}`
                          : rightId,
                      )}
              </p>
            </div>
            <button
              type="button"
              aria-pressed={changedOnly}
              onClick={() => setChangedOnly((v) => !v)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                changedOnly
                  ? "border-primary/40 bg-accent text-ink"
                  : "border-border/80 bg-paper/80 text-muted-foreground hover:text-ink"
              }`}
            >
              {changedOnly ? t("compare.filter.changedOn") : t("compare.filter.changedOff")}
            </button>
          </div>

          <div className="surface mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider">
                    {t("compare.col.rule")}
                  </th>
                  <th className="px-4 py-3 font-normal text-ink">{leftHeader}</th>
                  <th className="px-4 py-3 font-normal text-ink">{rightHeader}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      {t("compare.emptyChanged")}
                    </td>
                  </tr>
                ) : (
                  visible.map(({ id, ra, rb, rule, diff }) => {
                    const cat = rule?.category;
                    const topic = cat
                      ? tx(`category.${cat}` as StringKey, cat.replace(/_/g, " "))
                      : null;
                    return (
                      <tr
                        key={id}
                        className={`border-t ${diff ? "bg-unknown-soft/40" : ""}`}
                      >
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-medium leading-snug text-ink">
                            {rule?.title ?? t("compare.unnamedRule")}
                          </p>
                          {topic && (
                            <p className="mt-1 text-xs text-muted-foreground">{topic}</p>
                          )}
                          {diff && (
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                              {t("compare.changed")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          {ra ? <StatusBadge value={ra.result} size="md" /> : "—"}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          {rb ? <StatusBadge value={rb.result} size="md" /> : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">{t("compare.statusHint")}</p>

          <Link
            to="/"
            search={{ address: rightId, as_of: rightAsOf }}
            className="mt-5 inline-block text-sm font-medium text-primary hover:underline"
          >
            {t("compare.openLookup").replace(
              "{id}",
              rightAddr?.street_address ?? rightId,
            )}
          </Link>
        </>
      )}
    </div>
  );
}
