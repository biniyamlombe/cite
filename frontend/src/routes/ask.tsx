import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { AsOfDateSchema } from "@rhl/shared";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useLocale, useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";

const search = z.object({
  address: z.string().optional(),
  as_of: AsOfDateSchema.optional(),
});

export const Route = createFileRoute("/ask")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Ask · Cite" },
      {
        name: "description",
        content: "Ask a grounded question about retrieved rental rules at an address.",
      },
      { property: "og:title", content: "Ask · Cite" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  const t = useT();
  const { locale } = useLocale();
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/ask" });
  const addressId = s.address ?? "A0016";
  const asOf = s.as_of ?? DEFAULT_AS_OF;
  const [question, setQuestion] = useState("What is the rent increase limit?");
  const client = getCiteClient();

  const addrs = useQuery({
    queryKey: ["addresses", ""],
    queryFn: () => client.addresses("", 40),
  });

  const ask = useMutation({
    mutationFn: () => client.ask({ address_id: addressId, as_of: asOf, question, locale }),
  });

  const letter = useMutation({
    mutationFn: () =>
      client.letter({
        address_id: addressId,
        as_of: asOf,
        current_rent: 2400,
        new_rent: 2600,
        locale,
      }),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow={t("ask.eyebrow")} title={t("ask.title")}>
        {t("ask.lede")}
      </PageHeader>

      <form
        className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          ask.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("ask.address")}
          </span>
          <select
            value={addressId}
            onChange={(e) =>
              void nav({ search: (p) => ({ ...p, address: e.target.value }), replace: true })
            }
            className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5"
          >
            {(addrs.data ?? []).map((a) => (
              <option key={a.address_id} value={a.address_id}>
                {a.address_id} — {a.street_address}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("ask.question")}
          </span>
          <textarea
            required
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={ask.isPending}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {t("ask.submit")}
          </button>
          <button
            type="button"
            disabled={letter.isPending}
            onClick={() => letter.mutate()}
            className="rounded-lg border border-border/80 px-4 py-2.5 text-sm hover:bg-secondary"
          >
            {t("ask.letter")}
          </button>
        </div>
        {(ask.isError || letter.isError) && (
          <p className="text-sm text-conflict">
            {(ask.error || letter.error)?.message ?? "Request failed"}
          </p>
        )}
      </form>

      {ask.data && (
        <div className="mt-8 space-y-4">
          {ask.data.refused && (
            <p className="rounded-lg border border-conflict/30 bg-conflict/5 px-3 py-2 text-sm text-conflict">
              {t("ask.refused")}
            </p>
          )}
          <pre className="whitespace-pre-wrap rounded-2xl border border-border/70 bg-card p-5 text-sm leading-relaxed text-ink">
            {ask.data.answer}
          </pre>
          {ask.data.citations.map((c) => (
            <blockquote key={c.team_rule_id} className="rounded-xl border px-4 py-3 text-sm">
              <div className="font-mono text-[11px] text-primary">
                {c.citation} · {c.result}
              </div>
              <p className="mt-2 font-serif">“{c.quoted_span}”</p>
            </blockquote>
          ))}
          <p className="text-xs text-muted-foreground">{ask.data.disclaimer}</p>
        </div>
      )}

      {letter.data && (
        <div className="mt-8">
          <h2 className="font-serif text-xl text-ink">{t("ask.letterTitle")}</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl border bg-card p-5 text-sm">
            {letter.data.text}
          </pre>
        </div>
      )}

      <Link
        to="/check"
        search={{ address: addressId, as_of: asOf }}
        className="mt-8 inline-block text-sm text-primary hover:underline"
      >
        {t("ask.toCheck")}
      </Link>
    </div>
  );
}
