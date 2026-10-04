import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { AsOfDateSchema } from "@rhl/shared";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t("check.eyebrow")} title={t("check.title")}>
        {t("check.lede")}
      </PageHeader>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-xl shadow-ink/5"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("check.address")}
          </span>
          <select
            value={addressId}
            onChange={(e) =>
              void nav({ search: (p) => ({ ...p, address: e.target.value }), replace: true })
            }
            className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5"
          >
            {(addrQ.data ?? [{ address_id: addressId, street_address: addressId }]).map((a) => (
              <option key={a.address_id} value={a.address_id}>
                {a.address_id} — {a.street_address}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("check.current")}
            </span>
            <input
              type="number"
              min={1}
              step="0.01"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("check.new")}
            </span>
            <input
              type="number"
              min={1}
              step="0.01"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={m.isPending}
          className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {t("check.submit")}
        </button>
        {m.isError && <p className="text-sm text-conflict">{(m.error as Error).message}</p>}
      </form>

      {verdict && (
        <div className="mt-8 space-y-4">
          <div
            className={`rounded-2xl border px-5 py-4 ${
              verdict.kind === "over"
                ? "border-conflict/30 bg-conflict/5"
                : verdict.kind === "ok"
                  ? "border-applies/30 bg-applies/5"
                  : "border-border/70 bg-card"
            }`}
          >
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t(`check.kind.${verdict.kind}`)}
            </p>
            <p className="mt-2 font-serif text-3xl text-ink">
              {verdict.values.increase_pct}%
              {verdict.values.cap_pct != null ? (
                <span className="ml-2 text-base text-muted-foreground">
                  / {verdict.values.cap_pct}% {t("check.cap")}
                </span>
              ) : null}
            </p>
            {verdict.values.over_amount != null && (
              <p className="mt-2 text-sm text-conflict">
                {t("check.overBy").replace("{n}", String(verdict.values.over_amount))}
              </p>
            )}
            {verdict.need && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("check.need").replace("{key}", verdict.need.key)}
              </p>
            )}
          </div>
          {verdict.deciding_quotes.map((q) => (
            <blockquote
              key={q.team_rule_id}
              className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm leading-relaxed"
            >
              <div className="font-mono text-[11px] text-primary">{q.citation}</div>
              <p className="mt-2 font-serif text-ink">“{q.quoted_span}”</p>
              <a
                href={q.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                {t("check.source")}
              </a>
            </blockquote>
          ))}
          <p className="text-xs text-muted-foreground">{m.data?.disclaimer}</p>
          <Link
            to="/"
            search={{ address: addressId, as_of: asOf }}
            className="text-sm text-primary hover:underline"
          >
            {t("check.backLookup")}
          </Link>
        </div>
      )}
    </div>
  );
}
