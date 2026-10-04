import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";
import { useT, type StringKey } from "@/lib/i18n";
import type { AddressRow, ChangeResult, ChangeTest, TestId } from "@/lib/cite/types";
import { BeforeAfterStatus, StatusBadge } from "./status";

const PREVIEW = 8;

const STORY_FOCUS: Record<TestId, "flip" | "scope" | "pending" | "failed"> = {
  T1: "flip",
  T2: "scope",
  T3: "flip",
  T4: "pending",
  T5: "failed",
};

const TYPE_LABEL_KEY: Record<string, StringKey> = {
  as_of: "changes.type.as_of",
  boundary: "changes.type.boundary",
  pending: "changes.type.pending",
  negative: "changes.type.negative",
};

/** Turn tracker machine notes into a short human line; keep open-question prose. */
export function humanizeChangeNotes(
  notes: string,
  openQuestionFallback = "See open legal question.",
): { summary: string; openQuestion?: string; raw: string } {
  const raw = notes.trim();
  const openMatch = raw.match(/Open question:\s*(.+)$/i);
  const openQuestion = openMatch?.[1]?.trim();
  let body = openMatch ? raw.slice(0, openMatch.index).trim() : raw;
  body = body
    .replace(/\b[\w.]+=(true|false|\d+\/\d+|\d+)\b/gi, " ")
    .replace(/\bnot_yet_effective\b/gi, "not yet effective")
    .replace(/\bwrongly_applies\b/gi, "wrongly applies")
    .replace(/\brogue_cap\b/gi, "rogue cap")
    .replace(/\bpending_ok\b/gi, " ")
    .replace(/\s*[·|]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[;,]?\s*$/g, "")
    .trim();
  const sentence =
    body
      .split(/(?<=\.)\s+/)
      .map((s) => s.trim())
      .find((s) => s.length > 24 && !/^[a-z_]+ on /.test(s)) ?? body;
  return {
    summary: sentence || (openQuestion ? openQuestionFallback : ""),
    ...(openQuestion ? { openQuestion } : {}),
    raw,
  };
}

function scopeSummary(ids: string[], addresses: AddressRow[]) {
  const cities = new Map<string, number>();
  for (const id of ids) {
    const a = addresses.find((x) => x.address_id === id);
    const city = a?.legal_city || a?.postal_city || "Unknown";
    cities.set(city, (cities.get(city) ?? 0) + 1);
  }
  return [...cities.entries()].sort((a, b) => b[1] - a[1]);
}

export function AffectedPropertiesTable({
  ids,
  addresses,
  result,
  conflicts,
  asOfLink,
}: {
  ids: string[];
  addresses: AddressRow[];
  result: ChangeResult;
  conflicts?: string[] | undefined;
  asOfLink?: string | undefined;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  if (ids.length === 0) {
    return (
      <p className="border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
        {t("changes.noneAffected")}
      </p>
    );
  }
  const visible = expanded ? ids : ids.slice(0, PREVIEW);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-border/80">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium [&>th]:eyebrow">
              <th>{t("changes.col.address")}</th>
              <th>{t("changes.col.jurisdiction")}</th>
              <th>{t("changes.col.before")}</th>
              <th>{t("changes.col.after")}</th>
              <th>{t("changes.col.review")}</th>
              <th className="print:hidden w-0" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {visible.map((id) => {
              const a = addresses.find((x) => x.address_id === id);
              return (
                <tr
                  key={id}
                  className="bg-card/40 transition-colors hover:bg-secondary/30 [&>td]:px-3 [&>td]:py-2.5"
                >
                  <td>
                    <Link
                      to="/"
                      search={{ address: id, ...(asOfLink ? { as_of: asOfLink } : {}) }}
                      className="group block"
                    >
                      <div className="text-ink transition-colors group-hover:text-primary">
                        {a?.street_address ?? id}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{id}</div>
                    </Link>
                  </td>
                  <td className="text-muted-foreground">
                    {a ? `${a.legal_city ?? a.postal_city}, ${a.state}` : "—"}
                  </td>
                  <td>
                    {result.before_status ? <StatusBadge value={result.before_status} /> : "—"}
                  </td>
                  <td>{result.after_status ? <StatusBadge value={result.after_status} /> : "—"}</td>
                  <td>
                    {conflicts?.includes(id) ? (
                      <StatusBadge value="conflict" label={t("status.conflict")} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="print:hidden text-right">
                    <Link
                      to="/"
                      search={{ address: id, ...(asOfLink ? { as_of: asOfLink } : {}) }}
                      className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
                    >
                      {t("changes.openLookup")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ids.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {expanded ? t("changes.showFewer") : `${t("changes.showAll")} (${ids.length})`}
        </button>
      )}
    </div>
  );
}

function ScopeStory({ affected, addresses }: { affected: string[]; addresses: AddressRow[] }) {
  const t = useT();
  const byCity = useMemo(() => scopeSummary(affected, addresses), [affected, addresses]);
  const newark = addresses.filter((a) => (a.legal_city || a.postal_city) === "Newark");
  const newarkLeak = affected.filter((id) => {
    const a = addresses.find((x) => x.address_id === id);
    return (a?.legal_city || a?.postal_city) === "Newark";
  });

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <MapPinned className="size-3.5 text-primary/70" /> {t("changes.scope")}
      </div>
      <ul className="mt-2 divide-y divide-border/70 border-t border-border/70">
        {byCity.map(([city, n]) => (
          <li key={city} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="text-ink">{city}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{n}</span>
          </li>
        ))}
      </ul>
      {newark.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-ink">{t("changes.excluded")}:</span> Newark (
          {newark.length} {t("changes.newarkSample")}
          {newarkLeak.length
            ? ` · WARNING: ${newarkLeak.length} ${t("changes.newarkWarn")}`
            : ` · ${t("changes.newarkNone")}`}
          )
        </p>
      )}
    </div>
  );
}

function ChangeNotes({
  notes,
  affected,
  conflicts,
  hideStorySummary,
}: {
  notes: string;
  affected: number;
  conflicts: number;
  /** When true, skip prose that restates the before/after flip already on screen. */
  hideStorySummary?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { summary, openQuestion, raw } = useMemo(
    () => humanizeChangeNotes(notes, t("changes.openQuestionFallback")),
    [notes, t],
  );
  const showTally = !hideStorySummary || conflicts > 0;
  const tally =
    conflicts > 0
      ? t("changes.notesTallyConflict")
          .replace("{a}", String(affected))
          .replace("{c}", String(conflicts))
      : t("changes.notesTally").replace("{a}", String(affected));
  const showSummary = Boolean(summary) && !hideStorySummary;

  if (!showTally && !showSummary && !openQuestion && !notes.trim()) return null;

  return (
    <div className="space-y-2">
      {(showTally || showSummary) && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {showTally ? (
            <span className="font-mono text-[11px] tabular-nums text-ink">{tally}</span>
          ) : null}
          {showSummary ? <span className="mt-1 block">{summary}</span> : null}
        </p>
      )}
      {openQuestion && (
        <p className="border border-unknown/25 bg-unknown-soft/50 px-3 py-2 text-sm text-ink/90">
          <span className="font-medium">{t("rule.openQuestion")}: </span>
          {openQuestion}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
      >
        {open ? t("changes.hideDetails") : t("changes.showDetails")}
      </button>
      {open && (
        <pre className="overflow-x-auto border border-border/70 bg-paper px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {raw}
        </pre>
      )}
    </div>
  );
}

export function ChangeImpactCard({
  test,
  result,
  addresses,
}: {
  test: ChangeTest;
  result?: ChangeResult | undefined;
  addresses: AddressRow[];
}) {
  const t = useT();
  const affected = result?.affected_address_ids ?? [];
  const conflicts = result?.conflict_flag_address_ids ?? [];
  const focus = STORY_FOCUS[test.test_id];
  const beatKey = `changes.beat.${test.test_id}` as StringKey;
  const hasFlip = Boolean(result?.before_status || result?.after_status);
  const lookupAsOf = test.as_of_after || test.as_of;
  const typeKey = TYPE_LABEL_KEY[test.type];
  const typeLabel = typeKey ? t(typeKey) : test.type.replace(/_/g, " ");
  const dateLine = [test.as_of_before, test.as_of_after || test.as_of].filter(Boolean).join(" → ");

  const scenarioKind = focus === "pending" || focus === "failed" ? "hypothetical" : "currentLaw";

  return (
    <article>
      <p
        className={`mb-10 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] ${
          scenarioKind === "hypothetical"
            ? "border-pending/30 bg-pending-soft text-ink"
            : "border-border/60 bg-card/60 text-muted-foreground"
        }`}
      >
        <span className="font-semibold text-ink">{t("changes.scenarioLabel")}.</span>
        {scenarioKind === "hypothetical" ? t("changes.hypothetical") : t("changes.currentLaw")}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border/70 pb-8">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase text-muted-foreground">
            <span translate="no" className="font-bold text-primary">
              {test.test_id}
            </span>
            <span aria-hidden="true">•</span>
            <span>{typeLabel}</span>
            {dateLine ? (
              <>
                <span aria-hidden="true">•</span>
                <span className="tabular-nums normal-case">
                  {t("changes.asOfMeta")} <span className="text-ink/70">{dateLine}</span>
                </span>
              </>
            ) : null}
          </div>
          <h2 className="font-serif text-3xl tracking-[-0.02em] text-ink sm:text-4xl">
            {test.title}
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {t(beatKey) || test.expected_behavior}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-right shadow-xl shadow-ink/5">
            <div className="font-serif text-5xl leading-none text-ink tabular-nums">
              {affected.length}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              {t("changes.affectedCount")}
            </div>
          </div>
          {conflicts.length > 0 && (
            <div className="rounded-2xl border border-conflict/25 bg-card p-6 text-right shadow-xl shadow-ink/5">
              <div className="font-serif text-5xl leading-none text-conflict tabular-nums">
                {conflicts.length}
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-conflict/80">
                {t("changes.reviewCount")}
              </div>
            </div>
          )}
        </div>
      </div>

      {result && hasFlip && (
        <div className="mt-5">
          <BeforeAfterStatus
            label={t("changes.story")}
            beforeDate={test.as_of_before}
            afterDate={test.as_of_after}
            before={result.before_status}
            after={result.after_status}
          />
        </div>
      )}

      {result?.per_address && Object.keys(result.per_address).length > 0 ? (
        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {t("changes.perAddressEvidence")
            .replace("{n}", String(Object.keys(result.per_address).length))
            .replace("{rules}", Object.keys(result.rule_mapping ?? {}).join(", ") || "—")}
        </p>
      ) : null}

      {result && focus === "scope" && (
        <div className="mt-5">
          <ScopeStory affected={affected} addresses={addresses} />
        </div>
      )}

      {result && focus === "failed" && (
        <div className="mt-5 border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
          {t("changes.failedNote")}
        </div>
      )}

      {result?.notes && (
        <div className="mt-5">
          <ChangeNotes
            notes={result.notes}
            affected={affected.length}
            conflicts={conflicts.length}
            hideStorySummary={hasFlip}
          />
        </div>
      )}

      {result && (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
            <h3 className="font-serif text-lg text-ink">
              {t("changes.affected")}
              <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground">
                {affected.length}
              </span>
            </h3>
            <div className="font-mono text-[11px] text-muted-foreground">
              {t("changes.rulesMeta")} {test.rule_ids.join(" · ")}
            </div>
          </div>
          <div className="mt-3">
            <AffectedPropertiesTable
              ids={affected}
              addresses={addresses}
              result={result}
              conflicts={conflicts}
              asOfLink={lookupAsOf}
            />
          </div>
        </div>
      )}
    </article>
  );
}
