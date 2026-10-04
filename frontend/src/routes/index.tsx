import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useT, useTx } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listAlertSubs, logLookup, saveMemo, setEmailAlert } from "@/lib/cite/team";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Loader2, AlertCircle, FileSearch, Printer, Link2, Check, Download,
  Eye, Mail, Save, GitCompare, FileText, Quote,
} from "lucide-react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { CATEGORY_ORDER } from "@/lib/cite/labels";
import type { AddressRow, LookupResponse } from "@/lib/cite/types";
import { PropertySummary } from "@/components/cite/property";
import { ResultSummaryChips } from "@/components/cite/status";
import { lookupToCsv, downloadText } from "@/lib/cite/export";
import { useWatchlist } from "@/lib/cite/watchlist";
import { EffectiveTimeline } from "@/components/cite/timeline";
import { RuleCard, RuleDetailDrawer, type RuleView } from "@/components/cite/rule";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Property Lookup — Cite" },
      { name: "description", content: "See which rental-housing regulations apply to a property, why they apply, and what is about to change." },
      { property: "og:title", content: "Property Lookup — Cite" },
      { property: "og:description", content: "Know what applies. And why. Traceable rental-housing regulation lookup." },
    ],
  }),
  validateSearch: z.object({
    address: z.string().optional(),
    as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  component: LookupPage,
});

const DEMO_CHIPS: ReadonlyArray<{ q: string; labelKey: "lookup.demo.unknown" | "lookup.demo.remap" | "lookup.demo.conflict" | "lookup.demo.stretch"; id: string }> = [
  { q: "A0005", labelKey: "lookup.demo.unknown", id: "A0005" },
  { q: "A0065", labelKey: "lookup.demo.remap", id: "A0065" },
  { q: "A0002", labelKey: "lookup.demo.conflict", id: "A0002" },
  { q: "SA0001", labelKey: "lookup.demo.stretch", id: "SA0001" },
];

function AddressSearch({ onSelect }: { onSelect: (a: AddressRow) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { data = [], isFetching } = useQuery({
    queryKey: ["addresses", q],
    queryFn: () => getCiteClient().addresses(q, 8),
    enabled: open,
  });
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const pick = (a: AddressRow) => { onSelect(a); setQ(a.street_address); setOpen(false); };
  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-3 rounded-lg border-2 border-input bg-card px-4 py-3.5 shadow-sm transition-colors focus-within:border-ring">
        <Search className="size-5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, data.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && data[active]) pick(data[active]);
          }}
          placeholder={t("lookup.placeholder")}
          className="w-full bg-transparent text-lg text-ink outline-none placeholder:text-muted-foreground/70"
          aria-label={t("lookup.label")}
        />
        {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {data.length === 0 && !isFetching && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">{t("lookup.none")}</li>
          )}
          {data.map((a, i) => {
            const differs = a.legal_city && a.legal_city !== a.postal_city;
            return (
              <li key={a.address_id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(a)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors ${i === active ? "bg-secondary" : ""}`}
                >
                  <span>
                    <span className="text-ink">{a.street_address}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {a.postal_city}{differs && <> → <strong className="text-foreground">{a.legal_city}</strong></>}, {a.state}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{a.address_id}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReadingOrder() {
  const t = useT();
  const steps = [t("lookup.stepWhat"), t("lookup.stepWhy"), t("lookup.stepEvidence")];
  return (
    <div className="fade-up-delay-2 mt-8">
      <div className="eyebrow text-center">{t("lookup.reading")}</div>
      <ol className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm">
        {steps.map((label, i) => (
          <li key={label} className="flex items-baseline gap-1.5 text-ink">
            {i > 0 && <span className="mx-1 text-muted-foreground/50" aria-hidden>→</span>}
            <span className="font-mono text-[11px] tabular-nums text-primary">{i + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyLookup({ onSelect }: { onSelect: (id: string) => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl py-10 text-center sm:py-16">
      <h1 className="fade-up font-serif text-4xl text-ink sm:text-5xl">
        {t("lookup.title1")}{" "}
        <span className="text-primary">{t("lookup.title2")}</span>
      </h1>
      <p className="fade-up-delay-1 mx-auto mt-4 max-w-xl text-muted-foreground">
        {t("lookup.lede")}
      </p>

      <div className="fade-up-delay-2 mt-8 text-left">
        <label className="mb-2 block text-sm font-medium text-ink">{t("lookup.label")}</label>
        <AddressSearch onSelect={(a) => onSelect(a.address_id)} />
        <div className="mt-4 space-y-2">
          <div className="text-center text-xs text-muted-foreground">{t("lookup.try")}</div>
          <div className="flex flex-wrap items-stretch justify-center gap-2">
            {DEMO_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={async () => {
                  const r = await getCiteClient().addresses(chip.q, 1);
                  if (r[0]) onSelect(r[0].address_id);
                  else onSelect(chip.id);
                }}
                className="group flex min-w-[8.5rem] flex-col items-start rounded-md border bg-card px-3 py-2 text-left transition-colors hover:border-ring hover:bg-secondary/60"
              >
                <span className="font-mono text-[11px] text-primary">{chip.id}</span>
                <span className="mt-0.5 text-xs text-ink group-hover:text-ink">{t(chip.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ReadingOrder />

      <blockquote className="fade-up-delay-3 mx-auto mt-10 max-w-xl rounded-md bg-quote/70 px-4 py-3 text-left">
        <div className="flex items-start gap-2">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
          <p className="font-serif text-[15px] leading-relaxed text-ink/85">{t("lookup.philosophy")}</p>
        </div>
      </blockquote>
    </div>
  );
}

function LookupLoading() {
  const t = useT();
  return (
    <div className="space-y-6 fade-up" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div>
          <div className="font-medium text-ink">{t("lookup.loading")}</div>
          <p className="text-xs">{t("lookup.loadingHint")}</p>
        </div>
      </div>
      <div className="surface overflow-hidden p-5 sm:p-6">
        <div className="skeleton-shimmer h-3 w-24 rounded-sm" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 max-w-md rounded-sm" />
        <div className="skeleton-shimmer mt-2 h-4 w-1/2 max-w-sm rounded-sm" />
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="skeleton-shimmer h-14 rounded-md" />
          <div className="skeleton-shimmer h-14 rounded-md" />
          <div className="skeleton-shimmer h-14 rounded-md" />
        </div>
      </div>
      <div>
        <div className="eyebrow mb-3">{t("lookup.summary")}</div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer h-9 w-28 rounded-md" />
          ))}
        </div>
      </div>
      <div>
        <div className="eyebrow mb-3">{t("lookup.rulesHeading")}</div>
        <div className="grid gap-3">
          <div className="skeleton-shimmer h-36 rounded-lg" />
          <div className="skeleton-shimmer h-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function LookupPage() {
  const t = useT();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const addressId = search.address ?? null;
  const asOf = search.as_of ?? DEFAULT_AS_OF;
  const setAddressId = (id: string) => navigate({ search: (p) => ({ ...p, address: id }) });
  const setAsOf = (v: string) => navigate({ search: (p) => ({ ...p, as_of: v }), replace: true });
  const [openRule, setOpenRule] = useState<RuleView | null>(null);
  const lookup = useQuery({
    queryKey: ["lookup", addressId, asOf],
    queryFn: () => getCiteClient().lookup(addressId!, asOf),
    enabled: !!addressId,
  });

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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {!addressId ? (
        <EmptyLookup onSelect={setAddressId} />
      ) : (
        <>
          <div className="print:hidden mb-6">
            <AddressSearch onSelect={(a) => setAddressId(a.address_id)} />
          </div>

          {lookup.isPending && <LookupLoading />}

          {lookup.isError && (
            <div className="surface fade-up flex gap-3 p-5">
              <AlertCircle className="size-5 shrink-0 text-destructive" />
              <div>
                <div className="font-medium text-ink">{t("lookup.errorTitle")}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(lookup.error as Error).message}. {t("lookup.errorHint")}
                </p>
                <button onClick={() => lookup.refetch()} className="mt-3 text-sm font-medium text-primary hover:underline">
                  {t("lookup.retry")}
                </button>
              </div>
            </div>
          )}

          {lookup.data && (
            <LookupResults data={lookup.data} asOf={asOf} setAsOf={setAsOf} onOpen={setOpenRule} />
          )}
        </>
      )}

      <RuleDetailDrawer
        view={openRule}
        asOf={lookup.data?.as_of}
        facts={lookup.data ? { yearBuilt: lookup.data.address.year_built, units: lookup.data.address.units, legalCity: lookup.data.jurisdiction.city } : undefined}
        onClose={() => setOpenRule(null)}
      />
    </div>
  );
}

function HonestyCallouts({ data }: { data: LookupResponse }) {
  const t = useT();
  const unknownN = data.results.filter((r) => r.result === "unknown").length;
  const conflictN = data.results.filter((r) => r.conflict_flag).length;
  if (!unknownN && !conflictN) return null;
  return (
    <div className="space-y-2">
      {unknownN > 0 && (
        <div className="flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-unknown" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{unknownN}</span>{" "}
            {t("result.unknown").toLowerCase()} — {t("lookup.honesty.unknown")}
          </p>
        </div>
      )}
      {conflictN > 0 && (
        <div className="flex gap-2.5 rounded-md border border-conflict/25 bg-conflict-soft px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-conflict" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{conflictN}</span>{" "}
            {t("result.conflict").toLowerCase()} — {t("lookup.honesty.conflict")}
          </p>
        </div>
      )}
    </div>
  );
}

function LookupResults({ data, asOf, setAsOf, onOpen }: { data: LookupResponse; asOf: string; setAsOf: (v: string) => void; onOpen: (v: RuleView) => void }) {
  const t = useT();
  const tx = useTx();
  const grouped = useMemo(() => {
    const withRule = data.results.filter((r) => r.rule);
    return CATEGORY_ORDER.map((c) => [c, withRule.filter((r) => r.rule!.category === c)] as const).filter(([, l]) => l.length);
  }, [data]);

  return (
    <div className="space-y-10">
      <MemoBar data={data} />

      <div className="fade-up">
        <PropertySummary data={data} asOf={asOf} onAsOf={setAsOf} />
      </div>

      {/* What applies */}
      <section className="fade-up-delay-1 space-y-3">
        <div>
          <h2 className="font-serif text-xl text-ink">{t("lookup.summary")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("lookup.stepWhat")}</p>
        </div>
        <ResultSummaryChips results={data.results} />
        <HonestyCallouts data={data} />
        <EffectiveTimeline data={data} />
      </section>

      {/* Why + Evidence via rule cards */}
      <section className="fade-up-delay-2 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-ink">{t("lookup.rulesHeading")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("lookup.rulesLede")}</p>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="surface flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FileSearch className="size-6 text-muted-foreground" />
            <div className="font-medium text-ink">{t("lookup.emptyRules")}</div>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("lookup.emptyRulesHint")} ({data.as_of})
            </p>
          </div>
        ) : (
          grouped.map(([cat, list]) => (
            <div key={cat}>
              <h3 className="eyebrow mb-3 flex items-center gap-2">
                {tx(`category.${cat}`)} <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10px] normal-case tracking-normal text-muted-foreground">{list.length}</span>
              </h3>
              <div className="grid gap-3">
                {list.map((r) => {
                  const v: RuleView = {
                    id: r.team_rule_id,
                    rule: r.rule!,
                    result: r.result,
                    explanation: r.explanation,
                    conflict: r.conflict_flag,
                  };
                  return <RuleCard key={r.team_rule_id} view={v} onOpen={() => onOpen(v)} />;
                })}
              </div>
            </div>
          ))
        )}
      </section>
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
  const subs = useQuery({ queryKey: ["alert-subs", user?.id], queryFn: listAlertSubs, enabled: !!user });
  const emailOn = !!subs.data?.some((s) => s.address_id === id && s.email_enabled);
  const [saved, setSaved] = useState(false);
  const save = useMutation({ mutationFn: () => saveMemo(data, null), onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 1500); qc.invalidateQueries({ queryKey: ["memos"] }); } });
  const toggleEmail = useMutation({ mutationFn: () => setEmailAlert(id, !emailOn), onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-subs"] }) });
  const needAuth = (fn: () => void) => () => (user ? fn() : navigate({ to: "/auth" }));
  useEffect(() => setGenerated(new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"), [data]);
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
        <div className="font-serif text-2xl text-ink">Cite — {t("memo.title")}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {data.address.address_id} · as of {data.as_of} · {t("memo.generated")} {generated}
        </div>
        <p className="mt-2 text-xs">{data.disclaimer}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <button
          onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-ink hover:bg-secondary"
        >
          {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copied ? t("action.copied") : t("action.share")}
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
          <Printer className="size-4" /> {t("action.print")}
        </button>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-ink"
          >
            {t("lookup.actions")}
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] rounded-md border bg-background py-1 shadow-sm">
              <button onClick={() => { watch.toggle(id); setMoreOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary">
                <Eye className="size-3.5" /> {w ? t("action.watching") : t("action.watch")}
              </button>
              <button onClick={needAuth(() => { toggleEmail.mutate(); setMoreOpen(false); })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary">
                <Mail className="size-3.5" /> {t("action.emailAlerts")}
              </button>
              <button onClick={needAuth(() => { save.mutate(); setMoreOpen(false); })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary">
                {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />} {saved ? t("action.saved") : t("action.saveMemo")}
              </button>
              <Link to="/compare" search={{ address: id, a: data.as_of }} onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary">
                <GitCompare className="size-3.5" /> {t("action.compare")}
              </Link>
              <Link to="/sources" search={{ address: id, as_of: data.as_of }} onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary">
                <FileText className="size-3.5" /> {t("action.sources")}
              </Link>
              <button onClick={() => { downloadText(`cite-${id}-${data.as_of}.csv`, lookupToCsv(data)); setMoreOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary">
                <Download className="size-3.5" /> {t("action.csv")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
