import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { AsOfDateSchema } from "@rhl/shared";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { useLocale, useT, type StringKey } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import {
  AnswerLines,
  CopyTextButton,
  FieldLabel,
  QuoteCard,
  ToolsStrip,
} from "@/components/cite/renter-tools";

const search = z.object({
  address: z.string().optional(),
  as_of: AsOfDateSchema.optional(),
});

const SUGGESTIONS: ReadonlyArray<StringKey> = ["ask.q.rent", "ask.q.evict", "ask.q.deposit"];

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
  const [question, setQuestion] = useState(() => t("ask.q.rent"));
  const [current, setCurrent] = useState("2400");
  const [next, setNext] = useState("2600");
  const [showLetterForm, setShowLetterForm] = useState(false);
  const client = getCiteClient();

  const addrs = useQuery({
    queryKey: ["addresses", ""],
    queryFn: () => client.addresses("", 40),
  });

  const ask = useMutation({
    mutationFn: (q?: string) =>
      client.ask({
        address_id: addressId,
        as_of: asOf,
        question: q ?? question,
        locale,
      }),
  });

  const letter = useMutation({
    mutationFn: () =>
      client.letter({
        address_id: addressId,
        as_of: asOf,
        current_rent: Number(current),
        new_rent: Number(next),
        locale,
      }),
  });

  const selected = (addrs.data ?? []).find((a) => a.address_id === addressId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
      <ToolsStrip address={addressId} asOf={asOf} active="ask" />
      <PageHeader className="mb-4 fade-up" eyebrow={t("ask.eyebrow")} title={t("ask.title")}>
        {t("ask.lede")}
      </PageHeader>

      <form
        className="space-y-5"
        aria-busy={ask.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          ask.mutate();
        }}
      >
        <label className="block text-sm">
          <FieldLabel>{t("ask.address")}</FieldLabel>
          <select
            value={addressId}
            onChange={(e) =>
              void nav({ search: (p) => ({ ...p, address: e.target.value }), replace: true })
            }
            className="w-full rounded-lg border border-border/80 bg-card px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {(addrs.data ?? []).map((a) => (
              <option key={a.address_id} value={a.address_id}>
                {a.street_address}, {a.postal_city}
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {selected.street_address}
              {selected.legal_city ? `, ${selected.legal_city}` : ""}
              {`, as of ${asOf}`}
            </p>
          )}
        </label>

        <div>
          <label htmlFor="ask-question" className="block text-sm">
            <FieldLabel>{t("ask.question")}</FieldLabel>
          </label>
          <div className="bezel">
            <textarea
              id="ask-question"
              required
              minLength={3}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-[calc(var(--radius-xl)-2px)] bg-card px-4 py-4 font-serif text-lg leading-relaxed text-ink focus-visible:outline-none"
            />
          </div>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
            {SUGGESTIONS.map((key) => {
              const q = t(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setQuestion(q);
                    ask.mutate(q);
                  }}
                  className={`py-1 text-left text-sm underline-offset-4 transition-colors hover:text-primary hover:underline ${
                    question === q ? "font-medium text-ink" : "text-muted-foreground"
                  }`}
                >
                  {q}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={ask.isPending || question.trim().length < 3}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
        >
          {ask.isPending ? t("ask.reading") : t("ask.submit")}
        </button>
        {ask.isError && (
          <p role="alert" className="text-sm text-conflict">
            {ask.error.message}
          </p>
        )}
      </form>

      {ask.isPending && (
        <div aria-live="polite" className="mt-10 space-y-3">
          <p className="text-sm text-muted-foreground">{t("ask.reading")}</p>
          <div className="skeleton-shimmer h-5 w-4/5 rounded" />
          <div className="skeleton-shimmer h-5 w-3/5 rounded" />
          <div className="skeleton-shimmer h-5 w-2/3 rounded" />
        </div>
      )}

      {ask.data && !ask.isPending && (
        <div className="fade-up mt-10 space-y-5">
          {ask.data.refused && (
            <p
              role="status"
              className="rounded-lg border border-conflict/30 bg-conflict/5 px-4 py-3 text-sm text-conflict"
            >
              {t("ask.refused")}
            </p>
          )}
          <AnswerLines text={ask.data.answer} />
          {ask.data.citations.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-serif text-xl text-ink">{t("ask.evidence")}</h2>
              {ask.data.citations.map((c) => (
                <QuoteCard
                  key={c.team_rule_id}
                  citation={c.citation}
                  quote={c.quoted_span}
                  meta={c.result}
                  sourceUrl={c.source_url}
                  sourceLabel={t("check.source")}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{ask.data.disclaimer}</p>
        </div>
      )}

      <section className="mt-12 border-t border-border/80 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">{t("ask.letterTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("ask.letterLede")}</p>
          </div>
          {!showLetterForm && (
            <button
              type="button"
              onClick={() => setShowLetterForm(true)}
              className="rounded-full border border-border/80 px-3.5 py-1.5 text-sm hover:bg-secondary"
            >
              {t("ask.letter")}
            </button>
          )}
        </div>

        {showLetterForm && (
          <form
            className="mt-5 space-y-4 border-t border-border/60 pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              letter.mutate();
            }}
          >
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
              disabled={letter.isPending}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {letter.isPending ? t("common.loading") : t("ask.letterGenerate")}
            </button>
            {letter.isError && (
              <p role="alert" className="text-sm text-conflict">
                {letter.error.message}
              </p>
            )}
          </form>
        )}

        {letter.data && (
          <div className="mt-5 space-y-3 border-t border-border/60 pt-5 fade-up">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("ask.letterDraft")}
              </p>
              <CopyTextButton
                text={letter.data.text}
                label={t("ask.copy")}
                copiedLabel={t("action.copied")}
              />
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-background/80 px-4 py-4 font-serif text-[0.95rem] leading-relaxed text-ink">
              {letter.data.text}
            </pre>
            <p className="text-xs text-muted-foreground">{letter.data.disclaimer}</p>
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link
          to="/check"
          search={{ address: addressId, as_of: asOf }}
          className="font-medium text-primary hover:underline"
        >
          {t("ask.toCheck")}
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
  );
}
