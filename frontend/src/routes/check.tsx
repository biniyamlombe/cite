import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { AsOfDateSchema } from "@rhl/shared";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import {
  FieldLabel,
  QuoteCard,
  ToolsStrip,
} from "@/components/cite/renter-tools";

const search = z.object({
  address: z.string().optional(),
  as_of: AsOfDateSchema.optional(),
});

export const Route = createFileRoute("/check")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Rent increase check · Cite" },
      {
        name: "description",
        content: "Compare a proposed rent increase with applying rent-limit rules at an address.",
      },
      { property: "og:title", content: "Rent increase check · Cite" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckPage,
});

function CheckPage() {
  const t = useT();
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/check" });
  const addressId = s.address ?? "A0016";
  const asOf = s.as_of ?? DEFAULT_AS_OF;
  const [current, setCurrent] = useState("2400");
  const [next, setNext] = useState("2600");
  const client = getCiteClient();

  const addrQ = useQuery({
    queryKey: ["addresses", ""],
    queryFn: () => client.addresses("", 40),
  });

  const m = useMutation({
    mutationFn: () =>
      client.checkRent({
        address_id: addressId,
        as_of: asOf,
        current_rent: Number(current),
        new_rent: Number(next),
      }),
  });

  const verdict = m.data?.verdict;
  const selected = (addrQ.data ?? []).find((a) => a.address_id === addressId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <ToolsStrip address={addressId} asOf={asOf} active="check" />
      <PageHeader eyebrow={t("check.eyebrow")} title={t("check.title")}>
        {t("check.lede")}
      </PageHeader>

      <form
        className="surface mt-8 space-y-5 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <label className="block text-sm">
          <FieldLabel>{t("check.address")}</FieldLabel>
          <select
            value={addressId}
            onChange={(e) =>
              void nav({ search: (p) => ({ ...p, address: e.target.value }), replace: true })
            }
            className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {(addrQ.data ?? [{ address_id: addressId, street_address: addressId, postal_city: "" }]).map(
              (a) => (
                <option key={a.address_id} value={a.address_id}>
                  {a.street_address}
                  {a.postal_city ? `, ${a.postal_city}` : ""}
                </option>
              ),
            )}
          </select>
          {selected && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {selected.street_address}
              {selected.legal_city ? ` · ${selected.legal_city}` : ""}
              {` · as of ${asOf}`}
            </p>
          )}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <FieldLabel>{t("check.current")}</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                min={1}
                step="0.01"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-background py-2.5 pl-7 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
          </label>
          <label className="block text-sm">
            <FieldLabel>{t("check.new")}</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                min={1}
                step="0.01"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-background py-2.5 pl-7 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={m.isPending}
          className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
        >
          {m.isPending ? t("common.loading") : t("check.submit")}
        </button>
        {m.isError && (
          <p role="alert" className="text-sm text-conflict">
            {(m.error as Error).message}
          </p>
        )}
      </form>

      {verdict && (
        <div className="mt-10 space-y-5 fade-up">
          <div
            className={`surface px-5 py-6 sm:px-7 ${
              verdict.kind === "over"
                ? "border-conflict/35 bg-conflict/5"
                : verdict.kind === "ok"
                  ? "border-applies/35 bg-applies/5"
                  : ""
            }`}
          >
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t(`check.kind.${verdict.kind}`)}
            </p>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-serif text-5xl tracking-tight text-ink sm:text-6xl">
                {verdict.values.increase_pct}
                <span className="text-3xl">%</span>
              </p>
              {verdict.values.cap_pct != null && (
                <p className="text-base text-muted-foreground">
                  {t("check.vsCap")
                    .replace("{cap}", String(verdict.values.cap_pct))
                    .replace("{label}", t("check.cap"))}
                </p>
              )}
            </div>
            <dl className="mt-5 grid gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("check.current")}
                </dt>
                <dd className="mt-0.5 font-medium text-ink">${verdict.values.current_rent}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("check.new")}
                </dt>
                <dd className="mt-0.5 font-medium text-ink">${verdict.values.new_rent}</dd>
              </div>
              {verdict.values.max_rent != null && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("check.maxRent")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-ink">${verdict.values.max_rent}</dd>
                </div>
              )}
            </dl>
            {verdict.values.over_amount != null && (
              <p className="mt-4 text-sm text-conflict">
                {t("check.overBy").replace("{n}", `$${verdict.values.over_amount}`)}
              </p>
            )}
            {verdict.need && (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("check.need").replace("{key}", verdict.need.key)}
              </p>
            )}
          </div>

          {verdict.deciding_quotes.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-serif text-xl text-ink">{t("check.evidence")}</h2>
              {verdict.deciding_quotes.map((q) => (
                <QuoteCard
                  key={q.team_rule_id}
                  citation={q.citation}
                  quote={q.quoted_span}
                  sourceUrl={q.source_url}
                  sourceLabel={t("check.source")}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{m.data?.disclaimer}</p>

          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              to="/ask"
              search={{ address: addressId, as_of: asOf }}
              className="font-medium text-primary hover:underline"
            >
              {t("check.toAsk")}
            </Link>
            <Link
              to="/"
              search={{ address: addressId, as_of: asOf }}
              className="text-muted-foreground hover:text-primary hover:underline"
            >
              {t("check.backLookup")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
