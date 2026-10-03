import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useT } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listAlertSubs, logLookup, saveMemo, setEmailAlert } from "@/lib/cite/team";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, AlertCircle, FileSearch, Printer, Link2, Check, Download, Eye, Mail, Save, GitCompare, FileText } from "lucide-react";
import { DEFAULT_AS_OF, getCiteClient } from "@/lib/cite/client";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/cite/labels";
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

const SAMPLES = ["A0001", "Dorchester", "Hoboken", "A0006"];

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
      <div className="flex items-center gap-3 rounded-lg border-2 border-input bg-card px-4 py-3.5 shadow-sm focus-within:border-ring">
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
          {data.length === 0 && !isFetching && <li className="px-4 py-3 text-sm text-muted-foreground">{t("lookup.none")}</li>}
          {data.map((a, i) => {
            const differs = a.legal_city && a.legal_city !== a.postal_city;
            return (
              <li key={a.address_id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(a)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left ${i === active ? "bg-secondary" : ""}`}
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
      <div className={addressId ? "mb-8" : "mx-auto max-w-3xl py-10 text-center sm:py-16"}>
        {!addressId && (
          <>
            <div className="eyebrow">{t("lookup.eyebrow")}</div>
            <h1 className="mt-3 font-serif text-4xl text-ink sm:text-5xl">{t("lookup.title1")} <span className="text-primary">{t("lookup.title2")}</span></h1>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              {t("lookup.lede")}
            </p>
          </>
        )}
        <div className={addressId ? "print:hidden" : "mt-8 text-left"}>
          {!addressId && <label className="mb-2 block text-sm font-medium text-ink">{t("lookup.label")}</label>}
          <AddressSearch onSelect={(a) => setAddressId(a.address_id)} />
          {!addressId && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              {t("lookup.try")}
              {SAMPLES.map((s) => (
                <button key={s} onClick={async () => { const r = await getCiteClient().addresses(s, 1); if (r[0]) setAddressId(r[0].address_id); }}
                  className="rounded-sm border bg-card px-2 py-1 font-mono hover:text-ink">{s}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {addressId && lookup.isPending && (
        <div className="space-y-4">
          <div className="surface h-48 animate-pulse" />
          <div className="surface h-12 animate-pulse" />
          <div className="surface h-32 animate-pulse" />
        </div>
      )}
      {lookup.isError && (
        <div className="surface flex gap-3 p-5">
          <AlertCircle className="size-5 text-destructive" />
          <div>
            <div className="font-medium text-ink">Lookup could not be completed</div>
            <p className="text-sm text-muted-foreground">{(lookup.error as Error).message}. Try another address or retry shortly.</p>
            <button onClick={() => lookup.refetch()} className="mt-2 text-sm text-primary hover:underline">Retry</button>
          </div>
        </div>
      )}
      {lookup.data && <LookupResults data={lookup.data} asOf={asOf} setAsOf={setAsOf} onOpen={setOpenRule} />}

      <RuleDetailDrawer
        view={openRule}
        asOf={lookup.data?.as_of}
        facts={lookup.data ? { yearBuilt: lookup.data.address.year_built, units: lookup.data.address.units, legalCity: lookup.data.jurisdiction.city } : undefined}
        onClose={() => setOpenRule(null)}
      />
    </div>
  );
}

function LookupResults({ data, asOf, setAsOf, onOpen }: { data: LookupResponse; asOf: string; setAsOf: (v: string) => void; onOpen: (v: RuleView) => void }) {
  const grouped = useMemo(() => {
    const withRule = data.results.filter((r) => r.rule);
    return CATEGORY_ORDER.map((c) => [c, withRule.filter((r) => r.rule!.category === c)] as const).filter(([, l]) => l.length);
  }, [data]);
  return (
    <div className="space-y-8">
      <MemoBar data={data} />
      <PropertySummary data={data} asOf={asOf} onAsOf={setAsOf} />
      <ResultSummaryChips results={data.results} />
      <EffectiveTimeline data={data} />
      {grouped.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 px-6 py-12 text-center">
          <FileSearch className="size-6 text-muted-foreground" />
          <div className="font-medium text-ink">No applicable rules returned</div>
          <p className="max-w-md text-sm text-muted-foreground">The evaluation returned no rules for this property on {data.as_of}. Rules that do not apply are omitted.</p>
        </div>
      ) : (
        grouped.map(([cat, list]) => (
          <section key={cat}>
            <h3 className="eyebrow mb-3 flex items-center gap-2">{CATEGORY_LABEL[cat]} <span className="h-px flex-1 bg-border" /></h3>
            <div className="grid gap-3">
              {list.map((r) => {
                const v: RuleView = { id: r.team_rule_id, rule: r.rule!, result: r.result, explanation: r.explanation, conflict: r.conflict_flag };
                return <RuleCard key={r.team_rule_id} view={v} onOpen={() => onOpen(v)} />;
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function MemoBar({ data }: { data: LookupResponse }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
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
  return (
    <>
      <div className="hidden border-b pb-4 print:block">
        <div className="font-serif text-2xl text-ink">Cite — {t("memo.title")}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {data.address.address_id} · as of {data.as_of} · {t("memo.generated")} {generated}
        </div>
        <p className="mt-2 text-xs">{data.disclaimer}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <button onClick={() => watch.toggle(id)} aria-pressed={w}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-ink hover:bg-secondary ${w ? "bg-secondary" : "bg-card"}`}>
          <Eye className="size-4" /> {w ? t("action.watching") : t("action.watch")}
        </button>
        <button onClick={needAuth(() => toggleEmail.mutate())} aria-pressed={emailOn}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-ink hover:bg-secondary ${emailOn ? "bg-secondary" : "bg-card"}`}>
          <Mail className="size-4" /> {t("action.emailAlerts")}{emailOn ? " ✓" : ""}
        </button>
        <button onClick={needAuth(() => save.mutate())} disabled={save.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-ink hover:bg-secondary">
          {saved ? <Check className="size-4" /> : <Save className="size-4" />} {saved ? t("action.saved") : t("action.saveMemo")}
        </button>
        <Link to="/compare" search={{ address: id, a: data.as_of }}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-ink hover:bg-secondary">
          <GitCompare className="size-4" /> Compare dates
        </Link>
        <Link to="/sources" search={{ address: id, as_of: data.as_of }}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-ink hover:bg-secondary">
          <FileText className="size-4" /> Sources
        </Link>
        <button onClick={() => downloadText(`cite-${id}-${data.as_of}.csv`, lookupToCsv(data))}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-ink hover:bg-secondary">
          <Download className="size-4" /> {t("action.csv")}
        </button>
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
      </div>
    </>
  );
}
