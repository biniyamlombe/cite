import { RuleComments, RuleVersionHistory } from "./team";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Quote, X } from "lucide-react";
import { useLocale, useT, useTx } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { coverageText, fmtDate } from "@/lib/cite/labels";
import type { LookupResultValue, Rule } from "@/lib/cite/types";
import { StatusBadge } from "./status";
import { ConflictWarning, OpenQuestionWarning, UnknownFactWarning, splitOpenQuestion } from "./warnings";
import { PropertyFacts } from "./property";

export interface RuleView {
  id: string;
  rule: Rule;
  result?: LookupResultValue | undefined;
  explanation?: string | undefined;
  conflict?: boolean | undefined;
}

export function RuleCard({ view, onOpen }: { view: RuleView; onOpen: () => void }) {
  const t = useT();
  const tx = useTx();
  const { rule, result, explanation, conflict } = view;
  const prominent = result === "applies";
  const lowConf = rule.confidence != null && rule.confidence < 0.5;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "group surface w-full p-4 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:border-ring/50 hover:shadow-sm sm:p-5",
        prominent && "bg-applies-soft/40",
        conflict && "border-conflict/30",
        result === "superseded" && "opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-ink">{rule.title}</h4>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {rule.citation} · {t(rule.level === "city" ? "level.city" : "level.state")} · {rule.jurisdiction}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {conflict && <StatusBadge value="conflict" label={t("status.conflict")} />}
          {lowConf && (
            <span className="inline-flex items-center rounded-sm border border-unknown/30 bg-unknown-soft px-2 py-0.5 text-[11px] font-medium text-unknown">
              {t("rule.lowConfidence")} · {Math.round((rule.confidence ?? 0) * 100)}%
            </span>
          )}
          {result ? (
            <StatusBadge value={result} size="md" />
          ) : (
            <StatusBadge value={rule.status} label={tx(`status.${rule.status}`)} size="md" />
          )}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/85">{rule.requirement}</p>
      {result === "unknown" && explanation ? (
        <div className="mt-3"><UnknownFactWarning explanation={explanation} compact /></div>
      ) : explanation ? (
        (() => {
          const { body, openQuestion } = splitOpenQuestion(explanation);
          return (
            <div className="mt-3 space-y-2">
              {body ? (
                <div className="rounded-md border border-border/80 bg-paper/80 px-3 py-2.5">
                  <div className="eyebrow">{t("lookup.why")}</div>
                  <p className="mt-1 text-sm leading-relaxed text-ink/90">{body}</p>
                </div>
              ) : null}
              {openQuestion ? <OpenQuestionWarning note={openQuestion} compact /> : null}
            </div>
          );
        })()
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <SourceMeta rule={rule} />
        <span className="shrink-0 text-xs font-medium text-primary transition-transform duration-200 group-hover:translate-x-0.5">
          {t("lookup.viewEvidence")} →
        </span>
      </div>
    </button>
  );
}

export function WhyThisApplies({ result, explanation }: { result?: LookupResultValue | undefined; explanation?: string | undefined }) {
  const t = useT();
  if (!explanation) return null;
  const unknown = result === "unknown";
  const { body, openQuestion } = splitOpenQuestion(explanation);
  return (
    <div className="space-y-2">
      {body ? (
        <section className={cn("rounded-md border p-4", unknown ? "border-unknown/25 bg-unknown-soft" : "border-applies/20 bg-applies-soft")}>
          <div className="eyebrow">{unknown ? t("rule.unable") : t("rule.whyApplies")}</div>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{body}</p>
        </section>
      ) : null}
      {openQuestion ? <OpenQuestionWarning note={openQuestion} /> : null}
    </div>
  );
}

function citationFormats(rule: Rule, locale: string): Record<string, string> {
  const year = rule.effective_date?.slice(0, 4);
  const ret = rule.retrieved_at ? fmtDate(rule.retrieved_at, locale) : null;
  return {
    Plain: `${rule.citation}. ${rule.title}. ${rule.source_url}${rule.retrieved_at ? ` (retrieved ${rule.retrieved_at})` : ""}`,
    Bluebook: `${rule.citation}${year ? ` (${year})` : ""}.`,
    APA: `${rule.title}, ${rule.citation}${year ? ` (${year})` : ""}. ${ret ? `Retrieved ${ret}, from ` : ""}${rule.source_url}`,
  };
}

function CopyCitation({ rule }: { rule: Rule }) {
  const t = useT();
  const { locale } = useLocale();
  const [done, setDone] = useState<string | null>(null);
  const f = citationFormats(rule, locale);
  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span>{done ? `${t("action.copied")} (${done})` : t("action.copyCitation")}:</span>
      {Object.entries(f).map(([k, v]) => (
        <button key={k} onClick={async () => { await navigator.clipboard.writeText(v); setDone(k); setTimeout(() => setDone(null), 1500); }}
          className="rounded-sm border px-1.5 py-0.5 hover:bg-secondary hover:text-ink">{k}</button>
      ))}
    </div>
  );
}

export function CitationPanel({ rule, asOf, emphasize }: { rule: Rule; asOf?: string | undefined; emphasize?: boolean | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  const [open, setOpen] = useState(true);
  const [metaOpen, setMetaOpen] = useState(false);
  const long = rule.quoted_span.length > 220;
  return (
    <section className={cn("rounded-md border bg-paper", emphasize && "border-primary/30 ring-1 ring-primary/15")}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="eyebrow">{emphasize ? t("pipeline.verbatim") : t("rule.evidence")}</div>
          <div className="mt-0.5 font-mono text-sm font-medium text-ink">{rule.citation}</div>
        </div>
        <a href={rule.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Source <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="px-4 py-4">
        <figure className="quote-enter relative rounded-sm bg-quote px-4 py-3.5">
          <Quote className="mb-2 size-3.5 text-primary" />
          <blockquote className={cn("font-serif text-[16px] leading-relaxed text-ink", !open && long && "line-clamp-2")}>
            “{rule.quoted_span}”
          </blockquote>
        </figure>
        {long && (
          <button onClick={() => setOpen(!open)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
            {open ? t("rule.collapseQuote") : t("rule.expandQuote")}
          </button>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <CopyCitation rule={rule} />
          <button
            type="button"
            onClick={() => setMetaOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
          >
            <ChevronDown className={cn("size-3 transition-transform", metaOpen && "rotate-180")} />
            Meta
          </button>
        </div>
        {metaOpen && (
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
            <div><dt className="eyebrow">{t("rule.retrieved")}</dt><dd className="mt-0.5 font-mono">{fmtDate(rule.retrieved_at, locale)}</dd></div>
            <div><dt className="eyebrow">{t("rule.analysisAsOf")}</dt><dd className="mt-0.5 font-mono">{fmtDate(asOf, locale)}</dd></div>
            <div className="col-span-2 break-all"><dt className="eyebrow">URL</dt><dd className="mt-0.5 font-mono text-muted-foreground">{rule.source_url}</dd></div>
          </dl>
        )}
      </div>
    </section>
  );
}

function Confidence({ value }: { value?: number | null | undefined }) {
  if (value == null) return <span className="font-mono text-sm">—</span>;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-sm tabular-nums">{pct}%</span>
    </div>
  );
}

export function RuleDetailDrawer({
  view, asOf, facts, onClose,
}: {
  view: RuleView | null;
  asOf?: string | undefined;
  facts?: { yearBuilt?: string | undefined; units?: string | undefined; legalCity?: string | undefined } | undefined;
  onClose: () => void;
}) {
  const t = useT();
  const tx = useTx();
  const { locale } = useLocale();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!view) return null;
  const { rule, result, explanation, conflict } = view;
  const cov = coverageText(rule.coverage_conditions);
  const lowConf = rule.confidence != null && rule.confidence < 0.5;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30 animate-in fade-in duration-150" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-background shadow-2xl animate-in slide-in-from-right duration-200 ease-out">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-6 py-5 backdrop-blur">
          <div>
            <div className="eyebrow">
              {tx(`category.${rule.category}`)} · {t(rule.level === "city" ? "level.city" : "level.state")} · {rule.jurisdiction}
            </div>
            <h3 className="mt-1.5 font-serif text-2xl text-ink">{rule.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {conflict && <StatusBadge value="conflict" label={t("status.conflict")} size="md" />}
              {result && <StatusBadge value={result} size="md" />}
              <StatusBadge
                value={rule.status}
                label={`${t("rule.rulePrefix")}: ${tx(`status.${rule.status}`)}`}
                size="md"
              />
            </div>
          </div>
          <button onClick={onClose} aria-label={t("rule.close")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </header>
        <div className="space-y-6 px-6 py-6">
          <WhyThisApplies result={result} explanation={explanation} />
          {(conflict || rule.conflict_note) && <ConflictWarning note={rule.conflict_note} />}
          <CitationPanel rule={rule} asOf={asOf} />
          <section className={cn("rounded-md border p-4", lowConf && "border-unknown/30 bg-unknown-soft/50")}>
            <div className="eyebrow">{t("rule.confidence")}</div>
            <div className="mt-2"><Confidence value={rule.confidence} /></div>
            {lowConf && (
              <p className="mt-2 text-sm text-unknown">{t("rule.lowConfidence")}</p>
            )}
          </section>
          <section>
            <div className="eyebrow">{t("rule.requirement")}</div>
            <p className="mt-2 text-lg leading-snug text-ink">{rule.requirement}</p>
          </section>
          {rule.precedence_note && (
            <section className="rounded-md border bg-card p-4">
              <div className="eyebrow">{t("rule.precedence")}</div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{rule.precedence_note}</p>
            </section>
          )}
          {facts && (
            <section>
              <div className="eyebrow mb-2">{t("rule.facts")}</div>
              <PropertyFacts {...facts} />
            </section>
          )}
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="eyebrow">{t("rule.effective")}</dt>
              <dd className="mt-1 font-mono text-sm">{fmtDate(rule.effective_date, locale)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="eyebrow">{t("rule.coverage")}</dt>
              <dd className="mt-1 text-sm">{cov ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="eyebrow">{t("rule.exemptions")}</dt>
              <dd className="mt-1 text-sm">{rule.exemptions ?? "—"}</dd>
            </div>
          </dl>
          <RuleVersionHistory ruleId={view.id} defaultOpen />
          <RuleComments ruleId={view.id} />
        </div>
      </aside>
    </div>
  );
}

export function SourceMeta({ rule }: { rule: Rule }) {
  const t = useT();
  const { locale } = useLocale();
  if (rule.confidence == null && !rule.retrieved_at) return null;
  const days = rule.retrieved_at ? Math.floor((Date.now() - new Date(rule.retrieved_at).getTime()) / 86400000) : null;
  const stale = days != null && days > 180;
  return (
    <div className="mt-0 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
      {rule.confidence != null && (
        <span className={rule.confidence < 0.85 ? "text-unknown" : ""}>
          {t("rule.confidenceLabel")} {Math.round(rule.confidence * 100)}%
        </span>
      )}
      {rule.retrieved_at && (
        <span className={stale ? "text-unknown" : ""}>
          {t("rule.sourceRetrieved")} {fmtDate(rule.retrieved_at, locale)}
          {stale ? ` · ${t("rule.mayBeStale")}` : ""}
        </span>
      )}
    </div>
  );
}
