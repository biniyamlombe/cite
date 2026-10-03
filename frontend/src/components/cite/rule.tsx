import { RuleComments, RuleVersionHistory } from "./team";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Quote, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, STATUS_LABEL, coverageText, fmtDate } from "@/lib/cite/labels";
import type { LookupResultValue, Rule } from "@/lib/cite/types";
import { StatusBadge } from "./status";
import { ConflictWarning, UnknownFactWarning } from "./warnings";
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
  const { rule, result, explanation, conflict } = view;
  const prominent = result === "applies";
  return (
    <button
      onClick={onOpen}
      className={cn(
        "group surface w-full p-4 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:border-ring/50 hover:shadow-sm sm:p-5",
        prominent && "bg-applies-soft/40",
        result === "superseded" && "opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-ink">{rule.title}</h4>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {rule.citation} · {rule.level === "city" ? "City" : "State"} · {rule.jurisdiction}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {conflict && <StatusBadge value="conflict" label="Conflict" />}
          {result ? <StatusBadge value={result} size="md" /> : <StatusBadge value={rule.status} label={STATUS_LABEL[rule.status]} size="md" />}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/85">{rule.requirement}</p>
      {result === "unknown" && explanation ? (
        <div className="mt-3"><UnknownFactWarning explanation={explanation} compact /></div>
      ) : explanation ? (
        <div className="mt-3 rounded-md border border-border/80 bg-paper/80 px-3 py-2.5">
          <div className="eyebrow">{t("lookup.why")}</div>
          <p className="mt-1 text-sm leading-relaxed text-ink/90">{explanation}</p>
        </div>
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
  if (!explanation) return null;
  const unknown = result === "unknown";
  return (
    <section className={cn("rounded-md border p-4", unknown ? "border-unknown/25 bg-unknown-soft" : "border-applies/20 bg-applies-soft")}>
      <div className="eyebrow">{unknown ? "Unable to determine" : "Why this applies"}</div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">{explanation}</p>
    </section>
  );
}

function citationFormats(rule: Rule): Record<string, string> {
  const year = rule.effective_date?.slice(0, 4);
  const ret = rule.retrieved_at ? fmtDate(rule.retrieved_at) : null;
  return {
    Plain: `${rule.citation}. ${rule.title}. ${rule.source_url}${rule.retrieved_at ? ` (retrieved ${rule.retrieved_at})` : ""}`,
    Bluebook: `${rule.citation}${year ? ` (${year})` : ""}.`,
    APA: `${rule.title}, ${rule.citation}${year ? ` (${year})` : ""}. ${ret ? `Retrieved ${ret}, from ` : ""}${rule.source_url}`,
  };
}

function CopyCitation({ rule }: { rule: Rule }) {
  const t = useT();
  const [done, setDone] = useState<string | null>(null);
  const f = citationFormats(rule);
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

export function CitationPanel({ rule, asOf }: { rule: Rule; asOf?: string | undefined }) {
  const [open, setOpen] = useState(true);
  const long = rule.quoted_span.length > 220;
  return (
    <section className="rounded-md border bg-paper">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="eyebrow">Evidence</div>
          <div className="mt-0.5 font-mono text-sm font-medium text-ink">{rule.citation}</div>
        </div>
        <a href={rule.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Source <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="flex justify-end border-b px-4 py-1.5 print:hidden">
        <CopyCitation rule={rule} />
      </div>
      <div className="px-4 py-4">
        <figure className="relative rounded-sm bg-quote px-4 py-3">
          <Quote className="mb-2 size-3.5 text-primary" />
          <blockquote className={cn("font-serif text-[15px] leading-relaxed text-ink", !open && long && "line-clamp-2")}>
            “{rule.quoted_span}”
          </blockquote>
        </figure>
        {long && (
          <button onClick={() => setOpen(!open)} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
            {open ? "Collapse quotation" : "Expand quotation"}
          </button>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div><dt className="eyebrow">Retrieved</dt><dd className="mt-0.5 font-mono">{fmtDate(rule.retrieved_at)}</dd></div>
          <div><dt className="eyebrow">Analysis as of</dt><dd className="mt-0.5 font-mono">{fmtDate(asOf)}</dd></div>
          <div className="col-span-2 break-all"><dt className="eyebrow">URL</dt><dd className="mt-0.5 font-mono text-muted-foreground">{rule.source_url}</dd></div>
        </dl>
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
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!view) return null;
  const { rule, result, explanation, conflict } = view;
  const cov = coverageText(rule.coverage_conditions);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/25 animate-in fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-background shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-6 py-5 backdrop-blur">
          <div>
            <div className="eyebrow">{CATEGORY_LABEL[rule.category]} · {rule.level === "city" ? "City" : "State"} · {rule.jurisdiction}</div>
            <h3 className="mt-1.5 font-serif text-2xl text-ink">{rule.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {result && <StatusBadge value={result} size="md" />}
              <StatusBadge value={rule.status} label={`Rule: ${STATUS_LABEL[rule.status]}`} size="md" />
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </header>
        <div className="space-y-6 px-6 py-6">
          <section>
            <div className="eyebrow">Requirement</div>
            <p className="mt-2 text-lg leading-snug text-ink">{rule.requirement}</p>
          </section>
          <WhyThisApplies result={result} explanation={explanation} />
          {(conflict || rule.conflict_note) && <ConflictWarning note={rule.conflict_note} />}
          {rule.precedence_note && (
            <section className="rounded-md border bg-card p-4">
              <div className="eyebrow">Which rule takes precedence</div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{rule.precedence_note}</p>
            </section>
          )}
          {facts && (
            <section>
              <div className="eyebrow mb-2">Property facts on record</div>
              <PropertyFacts {...facts} />
            </section>
          )}
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><dt className="eyebrow">Effective date</dt><dd className="mt-1 font-mono text-sm">{fmtDate(rule.effective_date)}</dd></div>
            <div><dt className="eyebrow">Extraction confidence</dt><dd className="mt-1"><Confidence value={rule.confidence} /></dd></div>
            <div className="sm:col-span-2"><dt className="eyebrow">Coverage conditions</dt><dd className="mt-1 text-sm">{cov ?? "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="eyebrow">Exemptions</dt><dd className="mt-1 text-sm">{rule.exemptions ?? "—"}</dd></div>
          </dl>
          <CitationPanel rule={rule} asOf={asOf} />
          <RuleVersionHistory ruleId={view.id} />
          <RuleComments ruleId={view.id} />
        </div>
      </aside>
    </div>
  );
}

export function SourceMeta({ rule }: { rule: Rule }) {
  if (rule.confidence == null && !rule.retrieved_at) return null;
  const days = rule.retrieved_at ? Math.floor((Date.now() - new Date(rule.retrieved_at).getTime()) / 86400000) : null;
  const stale = days != null && days > 180;
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
      {rule.confidence != null && (
        <span className={rule.confidence < 0.85 ? "text-unknown" : ""}>confidence {Math.round(rule.confidence * 100)}%</span>
      )}
      {rule.retrieved_at && (
        <span className={stale ? "text-unknown" : ""}>source retrieved {fmtDate(rule.retrieved_at)}{stale ? " · may be stale" : ""}</span>
      )}
    </div>
  );
}
