import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AsOfDateSchema } from "@rhl/shared";
import { useLocale, useT, useTx } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listAlertSubs, logLookup, saveMemo, setEmailAlert } from "@/lib/cite/team";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Search,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileSearch,
  Printer,
  Link2,
  Check,
  Download,
  Eye,
  Mail,
  Save,
  GitCompare,
  FileText,
  ClipboardList,
  Calculator,
  MessageSquareText,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import type { AddressRow, LookupResponse } from "@/lib/cite/types";
import { PropertySummary } from "@/components/cite/property";
import { ResultSummaryChips } from "@/components/cite/status";
import { EvidenceFreshness } from "@/components/cite/evidence-freshness";
import { lookupToCsv, downloadText } from "@/lib/cite/export";
import { useWatchlist } from "@/lib/cite/watchlist";
import { EffectiveTimeline } from "@/components/cite/timeline";
import { RuleCard, RuleDetailDrawer, type RuleView } from "@/components/cite/rule";
import { CorpusGapWarning, isLinkOnlyScaffold } from "@/components/cite/warnings";
import { createCase } from "@/lib/cite/cases";
import { MissingFactsPanel, type FactOverrides } from "@/components/cite/missing-facts";
import { AuditTrailPanel } from "@/components/cite/audit-panel";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/cite/states";
import { groupResults } from "@/lib/cite/result-groups";
import { CiteApiError } from "@/lib/cite/api-error";
import type { StringKey } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Property Lookup · Cite" },
      {
        name: "description",
        content:
          "Legal information (not advice): see which rental-housing rules appear to apply, what is unknown, and cited sources.",
      },
      { property: "og:title", content: "Property Lookup · Cite" },
      {
        property: "og:description",
        content:
          "Rules that appear to apply — with citations, uncertainty, and human-review flags. Not legal advice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: z.object({
    address: z.string().optional(),
    as_of: AsOfDateSchema.optional(),
    rule: z.string().optional(),
    lang: z.enum(["en-US", "es-US", "en", "es"]).optional(),
  }),
  component: LookupPage,
});

const DEMO_CHIPS: ReadonlyArray<{
  q: string;
  labelKey: "lookup.demo.unknown" | "lookup.demo.remap" | "lookup.demo.conflict";
  id: string;
}> = [
  { q: "A0005", labelKey: "lookup.demo.unknown", id: "A0005" },
  { q: "A0065", labelKey: "lookup.demo.remap", id: "A0065" },
  { q: "A0002", labelKey: "lookup.demo.conflict", id: "A0002" },
];

export function AddressSearch({
  onSelect,
  prominent = false,
  onOpenChange,
}: {
  onSelect: (a: AddressRow) => void;
  prominent?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchError, setSearchError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const {
    data = [],
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["addresses", q],
    queryFn: () => getCiteClient().addresses(q, 8),
    enabled: open,
  });
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    const h = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (open)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, listId]);
  const pick = (a: AddressRow) => {
    onSelect(a);
    setQ(a.street_address);
    setOpen(false);
    inputRef.current?.focus();
  };
  const searchFirst = async () => {
    if (!q.trim()) return;
    setSearchError(false);
    try {
      const matches = await getCiteClient().addresses(q, 1);
      if (matches[0]) pick(matches[0]);
      else setOpen(true);
    } catch {
      setSearchError(true);
      setOpen(true);
    }
  };
  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div
        className={
          prominent
            ? "relative flex items-center overflow-hidden rounded-[calc(var(--radius-xl)-2px)] border border-border/60 bg-card transition-[border-color,box-shadow] duration-300 focus-within:border-primary/35 focus-within:shadow-dossier"
            : "flex items-center gap-3 rounded-xl border border-input bg-card/95 px-4 py-3.5 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-dossier"
        }
      >
        <Search
          aria-hidden="true"
          className={
            prominent
              ? "ml-5 mr-3 size-5 shrink-0 text-muted-foreground"
              : "size-5 text-muted-foreground"
          }
        />
        <input
          ref={inputRef}
          role="combobox"
          name="address-search"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && data[active] ? `${listId}-${active}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSearchError(false);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.max(0, Math.min(i + 1, data.length - 1)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && data[active]) pick(data[active]);
              else void searchFirst();
            }
            if (e.key === "Escape") setOpen(false);
          }}
          id="address-search"
          placeholder={t("lookup.placeholder")}
          className={
            prominent
              ? "min-w-0 flex-1 bg-transparent py-5 text-lg text-ink outline-none placeholder:text-muted-foreground/55 focus-visible:outline-none"
              : "w-full bg-transparent text-lg text-ink outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none"
          }
          aria-label={t("lookup.label")}
        />
        {isFetching && (
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
        )}
        {q.trim().length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setSearchError(false);
              setActive(0);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className={
              prominent
                ? "mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
                : "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
            }
            aria-label={t("lookup.clear")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {prominent && (
          <Button
            type="button"
            onClick={() => void searchFirst()}
            className="group mr-2 h-11 shrink-0 gap-2 rounded-full px-5 text-sm font-semibold shadow-sm transition-transform duration-200 active:scale-[0.98] sm:px-6"
            aria-label={t("lookup.search")}
          >
            <span>{t("lookup.search")}</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground/15">
              <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </Button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-dropdown">
          {data.length > 0 && (
            <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-5 py-2.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("lookup.results")}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {data.length}
              </span>
            </div>
          )}
          {(isError || searchError) && (
            <div role="alert" className="px-5 py-4 text-sm">
              {t("search.error")}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setSearchError(false);
                  void refetch();
                }}
              >
                {t("lookup.retry")}
              </button>
            </div>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label={t("lookup.results")}
            className="max-h-80 overflow-y-auto"
          >
            {data.length === 0 && !isFetching && !isError && !searchError && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                {t("lookup.none")}
              </div>
            )}
            {data.map((a, i) => {
              const differs = a.legal_city && a.legal_city !== a.postal_city;
              return (
                <button
                  key={a.address_id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(a)}
                  className={`group flex w-full items-center justify-between gap-4 border-b border-border/50 px-5 py-4 text-left transition-colors last:border-b-0 ${i === active ? "bg-secondary" : "hover:bg-secondary/50"}`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm font-semibold tracking-wide transition-colors ${i === active ? "text-primary" : "text-ink group-hover:text-primary"}`}
                    >
                      {a.street_address}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {a.postal_city}
                      {differs && (
                        <>
                          {" "}
                          → <span className="font-medium text-foreground">{a.legal_city}</span>
                        </>
                      )}
                      , {a.state}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                    {a.address_id}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t bg-secondary/50 px-5 py-2.5">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <kbd className="rounded-sm border bg-background px-1 font-mono text-[10px] shadow-sm">
                ↑↓
              </kbd>{" "}
              {t("lookup.kbdNavigate")}
              <span aria-hidden="true">·</span>
              <kbd className="rounded-sm border bg-background px-1 font-mono text-[10px] shadow-sm">
                ↵
              </kbd>{" "}
              {t("lookup.kbdSelect")}
            </span>
            {isFetching && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyLookup({ onSelect }: { onSelect: (id: string) => void }) {
  const t = useT();
  const [searchOpen, setSearchOpen] = useState(false);
  const dim = searchOpen
    ? "pointer-events-none opacity-0 transition-opacity duration-200"
    : "opacity-100 transition-opacity duration-200";
  return (
    <div className="mx-auto max-w-2xl pb-8 pt-2 sm:pt-4">
      <h1 className="fade-up text-pretty font-serif text-[clamp(2rem,4.2vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-ink">
        {t("lookup.title1")}
        <span className="mt-1 block pb-1 font-normal italic leading-[1.2] text-foreground/70">
          {t("lookup.title2")}
        </span>
      </h1>

      <div className="relative z-20 mt-6">
        <label htmlFor="address-search" className="mb-2 block text-sm font-medium text-ink">
          {t("lookup.label")}
        </label>
        <div className="bezel">
          <AddressSearch
            prominent
            onSelect={(a) => onSelect(a.address_id)}
            onOpenChange={setSearchOpen}
          />
        </div>
      </div>

      <div className={dim}>
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">{t("lookup.try")}</p>
          <ul className="mt-2 border-y border-border/80">
            {DEMO_CHIPS.map((chip) => (
              <li key={chip.id} className="border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(chip.id)}
                  className="group flex w-full touch-manipulation items-center gap-4 py-3 text-left transition-colors duration-200 hover:text-primary active:translate-y-px"
                >
                  <span translate="no" className="w-14 shrink-0 font-mono text-xs text-primary">
                    {chip.id}
                  </span>
                  <span className="min-w-0 flex-1 font-serif text-base text-ink group-hover:text-primary">
                    {t(chip.labelKey)}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          {t("lookup.philosophy")}
        </p>
      </div>
    </div>
  );
}

function LookupLoading() {
  const t = useT();
  return (
    <LoadingSkeleton
      title={t("lookup.loading")}
      hint={t("lookup.loadingHint")}
      stages={[
        t("lookup.loading.jurisdiction"),
        t("lookup.loading.dates"),
        t("lookup.loading.coverage"),
        t("lookup.loading.citations"),
      ]}
    />
  );
}

function LookupPage() {
  const t = useT();
  const { locale } = useLocale();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const addressId = search.address ?? null;
  const asOf = search.as_of ?? DEFAULT_AS_OF;
  const ruleId = search.rule ?? null;
  const setAddressId = (id: string) =>
    navigate({ search: (p) => ({ ...p, address: id, rule: undefined, lang: locale }) });
  const setAsOf = (v: string) =>
    navigate({ search: (p) => ({ ...p, as_of: v, lang: locale }), replace: true });
  const [openRule, setOpenRule] = useState<RuleView | null>(null);
  const [factOverrides, setFactOverrides] = useState<FactOverrides>({});
  const [includeNonApplicable, setIncludeNonApplicable] = useState(false);
  const lookup = useQuery({
    queryKey: ["lookup", addressId, asOf, factOverrides, includeNonApplicable, locale],
    queryFn: ({ signal }) => {
      const opts: import("@/lib/cite/client").LookupOptions = {
        includeNonApplicable,
        locale,
        signal,
      };
      if (factOverrides.yearBuilt) opts.yearBuilt = factOverrides.yearBuilt;
      if (factOverrides.units) opts.units = factOverrides.units;
      return getCiteClient().lookup(addressId!, asOf, opts);
    },
    enabled: !!addressId,
  });

  const openRuleView = (v: RuleView) => {
    setOpenRule(v);
    void navigate({ search: (p) => ({ ...p, rule: v.id }), replace: true });
  };
  const closeRule = () => {
    setOpenRule(null);
    void navigate({ search: (p) => ({ ...p, rule: undefined }), replace: true });
  };

  useEffect(() => {
    const d = lookup.data;
    if (!d || !ruleId) return;
    const r = d.results.find((x) => x.team_rule_id === ruleId && x.rule);
    if (!r?.rule) return;
    setOpenRule({
      id: r.team_rule_id,
      rule: r.rule,
      result: r.result,
      explanation: r.explanation,
      headline: r.headline?.text,
      plainLanguage: r.plain_language_summary,
      conflict: r.conflict_flag,
      needsHumanReview: r.needs_human_review,
      factsMissing: r.facts_missing,
      applicability: r.applicability,
    });
  }, [lookup.data, ruleId]);

  const { user: auditUser } = useAuth();
  const logged = useRef<string | null>(null);
  useEffect(() => {
    const d = lookup.data;
    if (!d || !auditUser) return;
    const k = `${d.address.address_id}|${d.as_of}`;
    if (logged.current === k) return;
    logged.current = k;
    logLookup(d).catch((e) => console.error("audit log failed", e));
  }, [lookup.data, auditUser]);

  return (
    <div
      className={`mx-auto max-w-6xl px-4 sm:px-6 ${addressId ? "py-10 sm:py-14" : "py-6 sm:py-8"}`}
    >
      {!addressId ? (
        <EmptyLookup onSelect={setAddressId} />
      ) : (
        <>
          <div className="print:hidden mb-6">
            <AddressSearch onSelect={(a) => setAddressId(a.address_id)} />
          </div>

          {lookup.isPending && <LookupLoading />}

          {lookup.isError && (
            <ErrorState
              title={t("lookup.errorTitle")}
              description={`${
                lookup.error instanceof CiteApiError
                  ? lookup.error.userMessage
                  : (lookup.error as Error).message
              } ${t("lookup.errorHint")}`}
              onRetry={() => void lookup.refetch()}
              retryLabel={t("lookup.retry")}
            />
          )}

          {lookup.data && (
            <LookupResults
              data={lookup.data}
              asOf={asOf}
              setAsOf={setAsOf}
              onOpen={openRuleView}
              factOverrides={factOverrides}
              onFactOverrides={setFactOverrides}
              includeNonApplicable={includeNonApplicable}
              onIncludeNonApplicable={setIncludeNonApplicable}
            />
          )}
        </>
      )}

      <RuleDetailDrawer
        view={openRule}
        addressId={lookup.data?.address.address_id}
        asOf={lookup.data?.as_of}
        facts={
          lookup.data
            ? {
                yearBuilt: lookup.data.address.year_built,
                units: lookup.data.address.units,
                legalCity: lookup.data.jurisdiction.city,
              }
            : undefined
        }
        onClose={closeRule}
      />
    </div>
  );
}

function HonestyCallouts({ data }: { data: LookupResponse }) {
  const t = useT();
  const unknownN = data.results.filter((r) => r.result === "unknown").length;
  const conflictN = data.results.filter((r) => r.conflict_flag).length;
  const pendingN = data.results.filter(
    (r) => r.result === "pending" || r.result === "not_yet_effective",
  ).length;
  const linkOnlyN = data.results.filter((r) => r.rule && isLinkOnlyScaffold(r.rule)).length;
  const gaps = data.corpus_gaps ?? [];
  const userFacts =
    data.building_facts?.facts_source === "user_provided" ||
    data.audit?.user_provided_facts === true;
  if (!unknownN && !conflictN && !pendingN && !linkOnlyN && !gaps.length && !userFacts) return null;
  return (
    <div className="space-y-2">
      {gaps.length > 0 && <CorpusGapWarning gaps={gaps} />}
      {userFacts && (
        <div
          role="status"
          className="flex gap-2.5 rounded-md border border-border/80 bg-secondary/50 px-3 py-2.5 text-sm"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <p className="text-ink/90">{t("lookup.honesty.userFacts")}</p>
        </div>
      )}
      {unknownN > 0 && (
        <div
          role="status"
          className="flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-unknown" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{unknownN}</span>{" "}
            {t("result.unknown").toLowerCase()} · {t("lookup.honesty.unknown")}
          </p>
        </div>
      )}
      {conflictN > 0 && (
        <div
          role="status"
          className="flex gap-2.5 rounded-md border border-conflict/25 bg-conflict-soft px-3 py-2.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-conflict" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{conflictN}</span>{" "}
            {t("result.conflict").toLowerCase()} · {t("lookup.honesty.conflict")}
          </p>
        </div>
      )}
      {pendingN > 0 && (
        <div
          role="status"
          className="flex gap-2.5 rounded-md border border-pending/30 bg-pending-soft px-3 py-2.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pending" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{pendingN}</span>{" "}
            {t("group.pending").toLowerCase()} · {t("lookup.honesty.pending")}
          </p>
        </div>
      )}
      {linkOnlyN > 0 && (
        <div
          role="status"
          className="flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-unknown" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{linkOnlyN}</span>{" "}
            {t("rule.linkOnly.badge").toLowerCase()} · {t("lookup.honesty.linkOnly")}
          </p>
        </div>
      )}
    </div>
  );
}

const GROUP_HEADING: Record<string, StringKey> = {
  applies: "group.applies",
  unknown: "group.unknown",
  needs_human_review: "group.review",
  does_not_apply: "group.does_not_apply",
  pending_future: "group.pending",
};

function LookupResults({
  data,
  asOf,
  setAsOf,
  onOpen,
  factOverrides,
  onFactOverrides,
  includeNonApplicable,
  onIncludeNonApplicable,
}: {
  data: LookupResponse;
  asOf: string;
  setAsOf: (v: string) => void;
  onOpen: (v: RuleView) => void;
  factOverrides: FactOverrides;
  onFactOverrides: (v: FactOverrides) => void;
  includeNonApplicable: boolean;
  onIncludeNonApplicable: (v: boolean) => void;
}) {
  const t = useT();
  const grouped = useMemo(() => groupResults(data.results), [data]);
  const [showMoreDna, setShowMoreDna] = useState(false);

  return (
    <div className="space-y-10">
      <MemoBar data={data} />

      <div className="fade-up">
        <PropertySummary data={data} asOf={asOf} onAsOf={setAsOf} />
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{t("lookup.asOfHelp")}</p>
      </div>

      <section className="fade-up-delay-1 space-y-3" aria-labelledby="answer-summary">
        <div>
          <h2 id="answer-summary" className="scroll-mt-24 text-pretty font-serif text-xl text-ink">
            {t("lookup.summary")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("lookup.stepWhat")}</p>
        </div>
        <ResultSummaryChips results={data.results} />
        <EvidenceFreshness data={data} />
        <HonestyCallouts data={data} />
        <MissingFactsPanel
          data={data}
          overrides={factOverrides}
          onApply={onFactOverrides}
          onClear={() => onFactOverrides({})}
        />
        <EffectiveTimeline data={data} />
        <AuditTrailPanel data={data} />
      </section>

      <section className="fade-up-delay-2 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">{t("lookup.rulesHeading")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("lookup.rulesLede")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeNonApplicable}
              onChange={(e) => onIncludeNonApplicable(e.target.checked)}
              className="size-4 rounded border-border"
            />
            {t("lookup.includeNonApplicable")}
          </label>
        </div>

        {grouped.length === 0 ? (
          <EmptyState
            title={t("lookup.emptyRules")}
            description={`${t("lookup.emptyRulesHint")} (${data.as_of})`}
            icon={FileSearch}
          />
        ) : (
          grouped.map(([groupKey, list]) => {
            const capped =
              groupKey === "does_not_apply" && !showMoreDna && list.length > 8
                ? list.slice(0, 8)
                : list;
            return (
              <div key={groupKey}>
                <h3 className="eyebrow mb-2 flex items-center gap-2">
                  {t(GROUP_HEADING[groupKey]!)} <span className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground">
                    {list.length}
                  </span>
                </h3>
                {groupKey === "pending_future" ? (
                  <p className="mb-3 text-xs text-muted-foreground">{t("group.pending.note")}</p>
                ) : null}
                <div className="grid gap-3">
                  {capped.map((r, i) => {
                    const v: RuleView = {
                      id: r.team_rule_id,
                      rule: r.rule!,
                      result: r.result,
                      explanation: r.explanation,
                      headline: r.headline?.text,
                      plainLanguage: r.plain_language_summary,
                      conflict: r.conflict_flag,
                      needsHumanReview: r.needs_human_review,
                      factsMissing: r.facts_missing,
                      applicability: r.applicability,
                    };
                    return (
                      <RuleCard key={r.team_rule_id} view={v} index={i} onOpen={() => onOpen(v)} />
                    );
                  })}
                </div>
                {groupKey === "does_not_apply" && list.length > 8 ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-primary hover:underline"
                    onClick={() => setShowMoreDna((v) => !v)}
                  >
                    {showMoreDna ? t("changes.showFewer") : t("changes.showAll")}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <footer className="border-t border-border/70 pt-6 text-xs text-muted-foreground">
        <p>{t("footer.boundary")}</p>
        <p className="mt-1">{t("footer.coverage")}</p>
        <p className="mt-1">
          {data.disclaimer} · {t("disclaimer.asOf")} {data.as_of}
        </p>
      </footer>
    </div>
  );
}

function MemoBar({ data }: { data: LookupResponse }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const watch = useWatchlist();
  const id = data.address.address_id;
  const w = watch.has(id);
  const [generated, setGenerated] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const subs = useQuery({
    queryKey: ["alert-subs", user?.id],
    queryFn: listAlertSubs,
    enabled: !!user,
  });
  const emailOn = !!subs.data?.some((s) => s.address_id === id && s.email_enabled);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => saveMemo(data, null),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      qc.invalidateQueries({ queryKey: ["memos"] });
      toast.success(t("toast.memoSaved"));
    },
  });
  const createReview = useMutation({
    mutationFn: () => createCase(data),
    onSuccess: (caseId) => {
      void qc.invalidateQueries({ queryKey: ["cases"] });
      void navigate({ to: "/workspace", search: { case: caseId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggleEmail = useMutation({
    mutationFn: () => setEmailAlert(id, !emailOn),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-subs"] }),
  });
  const needAuth = (fn: () => void) => () => (user ? fn() : navigate({ to: "/auth" }));
  useEffect(
    () => setGenerated(new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"),
    [data],
  );
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  return (
    <>
      <div className="hidden border-b pb-4 print:block">
        <div className="font-serif text-2xl text-ink">Cite · {t("memo.title")}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {data.address.address_id} · as of {data.as_of} · {t("memo.generated")} {generated}
        </div>
        <p className="mt-2 text-xs">{t("disclaimer")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("disclaimer.asOf")} {data.as_of}
        </p>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button
          variant="outline"
          disabled={createReview.isPending}
          onClick={needAuth(() => createReview.mutate())}
          className="rounded-full"
        >
          <ClipboardList />
          {t("workspace.openCase")}
        </Button>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            toast.success(t("toast.linkCopied"));
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-paper/80 px-3.5 py-1.5 text-sm text-ink transition-colors hover:bg-secondary"
        >
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copied ? t("action.copied") : t("action.share")}
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm text-primary-foreground shadow-sm transition-transform active:scale-[0.98] hover:bg-primary/92"
        >
          <Printer className="size-4" /> {t("action.print")}
        </button>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-paper/80 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
          >
            {t("lookup.actions")}
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] rounded-md border bg-background py-1 shadow-sm">
              <button
                onClick={() => {
                  const next = !w;
                  watch.toggle(id);
                  setMoreOpen(false);
                  toast.success(
                    (next ? t("toast.watching") : t("toast.unwatched")).replace("{id}", id),
                  );
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Eye className="size-3.5" /> {w ? t("action.watching") : t("action.watch")}
              </button>
              <button
                onClick={needAuth(() => {
                  toggleEmail.mutate();
                  setMoreOpen(false);
                })}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Mail className="size-3.5" /> {t("action.emailAlerts")}
              </button>
              <button
                onClick={needAuth(() => {
                  save.mutate();
                  setMoreOpen(false);
                })}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
              >
                {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}{" "}
                {saved ? t("action.saved") : t("action.saveMemo")}
              </button>
              <Link
                to="/compare"
                search={{ address: id, a: data.as_of }}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <GitCompare className="size-3.5" /> {t("action.compare")}
              </Link>
              <Link
                to="/check"
                search={{ address: id, as_of: data.as_of }}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <Calculator className="size-3.5" /> {t("nav.check")}
              </Link>
              <Link
                to="/ask"
                search={{ address: id, as_of: data.as_of }}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <MessageSquareText className="size-3.5" /> {t("nav.ask")}
              </Link>
              <Link
                to="/sources"
                search={{ address: id, as_of: data.as_of }}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
              >
                <FileText className="size-3.5" /> {t("action.sources")}
              </Link>
              <button
                onClick={() => {
                  downloadText(`cite-${id}-${data.as_of}.csv`, lookupToCsv(data));
                  setMoreOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Download className="size-3.5" /> {t("action.csv")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
