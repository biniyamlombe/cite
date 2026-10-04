import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useT, useTx } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listAlertSubs, logLookup, saveMemo, setEmailAlert } from "@/lib/cite/team";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, ArrowRight, Loader2, AlertCircle, FileSearch, Printer, Link2, Check, Download,
  Eye, Mail, Save, GitCompare, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { CATEGORY_ORDER } from "@/lib/cite/labels";
import type { AddressRow, LookupResponse } from "@/lib/cite/types";
import { PropertySummary } from "@/components/cite/property";
import { ResultSummaryChips } from "@/components/cite/status";
import { lookupToCsv, downloadText } from "@/lib/cite/export";
import { useWatchlist } from "@/lib/cite/watchlist";
import { EffectiveTimeline } from "@/components/cite/timeline";
import { RuleCard, RuleDetailDrawer, type RuleView } from "@/components/cite/rule";
import { isLinkOnlyScaffold } from "@/components/cite/warnings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Property Lookup — Cite" },
      { name: "description", content: "See which rental-housing regulations apply to a property, why they apply, and what is about to change." },
      { property: "og:title", content: "Property Lookup — Cite" },
      { property: "og:description", content: "Know what applies. And why. Traceable rental-housing regulation lookup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

function AddressSearch({ onSelect, prominent = false, onOpenChange }: { onSelect: (a: AddressRow) => void; prominent?: boolean; onOpenChange?: (open: boolean) => void }) {
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
    onOpenChange?.(open);
  }, [open]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const pick = (a: AddressRow) => { onSelect(a); setQ(a.street_address); setOpen(false); };
  const searchFirst = async () => {
    if (!q.trim()) return;
    const matches = await getCiteClient().addresses(q, 1);
    if (matches[0]) pick(matches[0]);
    else setOpen(true);
  };
  return (
    <div ref={ref} className="relative">
      <div className={prominent ? "relative flex items-center overflow-hidden rounded-[calc(var(--radius-xl)-2px)] border border-border/60 bg-card transition-shadow duration-300 focus-within:border-primary/35 focus-within:shadow-dossier" : "flex items-center gap-3 rounded-xl border border-input bg-card/95 px-4 py-3.5 shadow-sm transition-all duration-200 focus-within:border-ring focus-within:shadow-dossier"}>
        <Search className={prominent ? "ml-5 mr-3 size-5 shrink-0 text-muted-foreground" : "size-5 text-muted-foreground"} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, data.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); if (open && data[active]) pick(data[active]); else void searchFirst(); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={t("lookup.placeholder")}
          className={prominent ? "min-w-0 flex-1 bg-transparent py-5 text-lg text-ink outline-none placeholder:text-muted-foreground/55" : "w-full bg-transparent text-lg text-ink outline-none placeholder:text-muted-foreground/70"}
          aria-label={t("lookup.label")}
        />
        {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
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
        <div className="absolute z-30 mt-2 w-full overflow-hidden border bg-popover shadow-dropdown">
          {data.length > 0 && (
            <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-5 py-2.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("lookup.results")}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{data.length}</span>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto">
            {data.length === 0 && !isFetching && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">{t("lookup.none")}</div>
            )}
            {data.map((a, i) => {
              const differs = a.legal_city && a.legal_city !== a.postal_city;
              return (
                <button
                  key={a.address_id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(a)}
                  className={`group flex w-full items-center justify-between gap-4 border-b border-border/50 px-5 py-4 text-left transition-colors last:border-b-0 ${i === active ? "bg-secondary" : "hover:bg-secondary/50"}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold tracking-wide transition-colors ${i === active ? "text-primary" : "text-ink group-hover:text-primary"}`}>{a.street_address}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {a.postal_city}{differs && <> → <span className="font-medium text-foreground">{a.legal_city}</span></>}, {a.state}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">{a.address_id}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t bg-secondary/50 px-5 py-2.5">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <kbd className="rounded-sm border bg-background px-1 font-mono text-[10px] shadow-sm">↑↓</kbd> {t("lookup.kbdNavigate")}
              <span aria-hidden="true">·</span>
              <kbd className="rounded-sm border bg-background px-1 font-mono text-[10px] shadow-sm">↵</kbd> {t("lookup.kbdSelect")}
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
    ? "pointer-events-none opacity-10 transition-opacity duration-300"
    : "opacity-100 transition-opacity duration-300";
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-1 pb-10 pt-8 text-center sm:pt-12">
      <div className="fade-up">
        <h1 className="font-serif text-[clamp(3.25rem,10vw,4.75rem)] font-semibold leading-[0.92] tracking-[-0.035em] text-ink">
          Cite
        </h1>
        <p className="mx-auto mt-5 max-w-md font-serif text-lg italic leading-relaxed text-muted-foreground sm:text-xl">
          {t("lookup.title1")} {t("lookup.title2")}
        </p>
      </div>

      <div className="fade-up-delay-1 relative z-20 mx-auto mt-9 w-full max-w-2xl text-left">
        <label className="mb-2.5 ml-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("lookup.label")}
        </label>
        <div className="bezel">
          <AddressSearch prominent onSelect={(a) => onSelect(a.address_id)} onOpenChange={setSearchOpen} />
        </div>
      </div>

      <div className={`${dim} w-full`}>
        <div className="fade-up-delay-2 mx-auto mt-9 w-full max-w-2xl text-left">
          <div className="mb-3 ml-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("lookup.try")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={async () => {
                  const r = await getCiteClient().addresses(chip.q, 1);
                  if (r[0]) onSelect(r[0].address_id);
                  else onSelect(chip.id);
                }}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/90 p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-dossier active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] font-semibold text-primary">{chip.id}</span>
                  <span className="mt-1 block truncate font-serif text-sm italic text-ink">{t(chip.labelKey)}</span>
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform duration-300 group-hover:translate-x-0.5 group-hover:bg-accent">
                  <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary" />
                </span>
              </button>
            ))}
          </div>
        </div>
        <blockquote className="fade-up-delay-3 mx-auto mt-12 max-w-lg text-center">
          <p className="font-serif text-sm italic leading-relaxed text-muted-foreground">{t("lookup.philosophy")}</p>
        </blockquote>
      </div>
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
  const pendingN = data.results.filter((r) => r.result === "pending").length;
  const linkOnlyN = data.results.filter((r) => r.rule && isLinkOnlyScaffold(r.rule)).length;
  if (!unknownN && !conflictN && !pendingN && !linkOnlyN) return null;
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
      {pendingN > 0 && (
        <div className="flex gap-2.5 rounded-md border border-border/80 bg-secondary/50 px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{pendingN}</span>{" "}
            {t("result.pending").toLowerCase()} — {t("lookup.honesty.pending")}
          </p>
        </div>
      )}
      {linkOnlyN > 0 && (
        <div className="flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-unknown" />
          <p className="text-ink/90">
            <span className="font-mono tabular-nums font-semibold">{linkOnlyN}</span>{" "}
            {t("rule.linkOnly.badge").toLowerCase()} — {t("lookup.honesty.linkOnly")}
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
        <p className="mt-2 text-xs">{t("disclaimer")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("disclaimer.asOf")} {data.as_of}</p>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 print:hidden">
        <button
          onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
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
