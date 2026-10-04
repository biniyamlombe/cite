import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, GitMerge, MapPinned } from "lucide-react";
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

const TYPE_LABEL: Record<string, string> = {
  as_of: "Date flip",
  boundary: "Scope",
  pending: "Pending",
  negative: "Failed",
};

/** Turn tracker machine notes into a short human line; keep open-question prose. */
export function humanizeChangeNotes(notes: string): { summary: string; openQuestion?: string; raw: string } {
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
  // Prefer a single readable sentence (skip fragments that are only metrics residue)
  const sentence =
    body
      .split(/(?<=\.)\s+/)
      .map((s) => s.trim())
      .find((s) => s.length > 24 && !/^[a-z_]+ on /.test(s)) ?? body;
  return {
    summary: sentence || (openQuestion ? "See open legal question." : ""),
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
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {t("changes.noneAffected")}
      </p>
    );
  }
  const visible = expanded ? ids : ids.slice(0, PREVIEW);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
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
                <tr key={id} className="bg-card transition-colors hover:bg-secondary/30 [&>td]:px-3 [&>td]:py-2.5">
                  <td>
                    <Link
                      to="/"
                      search={{ address: id, ...(asOfLink ? { as_of: asOfLink } : {}) }}
                      className="group block"
                    >
                      <div className="text-ink transition-colors group-hover:text-primary">{a?.street_address ?? id}</div>
                      <div className="font-mono text-xs text-muted-foreground">{id}</div>
                    </Link>
                  </td>
                  <td className="text-muted-foreground">
                    {a ? `${a.legal_city ?? a.postal_city}, ${a.state}` : "—"}
                  </td>
                  <td>{result.before_status ? <StatusBadge value={result.before_status} /> : "—"}</td>
                  <td>{result.after_status ? <StatusBadge value={result.after_status} /> : "—"}</td>
                  <td>
                    {conflicts?.includes(id) ? (
                      <StatusBadge value="conflict" label="Conflict" />
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

function ScopeStory({
  affected,
  addresses,
}: {
  affected: string[];
  addresses: AddressRow[];
}) {
  const t = useT();
  const byCity = useMemo(() => scopeSummary(affected, addresses), [affected, addresses]);
  const newark = addresses.filter((a) => (a.legal_city || a.postal_city) === "Newark");
  const newarkLeak = affected.filter((id) => {
    const a = addresses.find((x) => x.address_id === id);
    return (a?.legal_city || a?.postal_city) === "Newark";
  });

  return (
    <div className="rounded-md border bg-paper p-4">
      <div className="eyebrow mb-3 flex items-center gap-1.5">
        <MapPinned className="size-3" /> {t("changes.scope")}
      </div>
      <div className="flex flex-wrap gap-2">
        {byCity.map(([city, n]) => (
          <div key={city} className="rounded-md border bg-card px-3 py-2 text-sm">
            <span className="font-medium text-ink">{city}</span>
            <span className="ml-2 font-mono tabular-nums text-muted-foreground">{n}</span>
          </div>
        ))}
      </div>
      {newark.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-ink">{t("changes.excluded")}:</span>{" "}
          Newark ({newark.length} {t("changes.newarkSample")}
          {newarkLeak.length
            ? ` — WARNING: ${newarkLeak.length} ${t("changes.newarkWarn")}`
            : ` — ${t("changes.newarkNone")}`}
          )
        </p>
      )}
    </div>
  );
}

function ChangeNotes({ notes, affected, conflicts }: { notes: string; affected: number; conflicts: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { summary, openQuestion, raw } = useMemo(() => humanizeChangeNotes(notes), [notes]);
  const tally =
    conflicts > 0
      ? t("changes.notesTallyConflict").replace("{a}", String(affected)).replace("{c}", String(conflicts))
      : t("changes.notesTally").replace("{a}", String(affected));

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-mono text-[11px] tabular-nums text-ink">{tally}</span>
        {summary ? <span className="mt-1 block">{summary}</span> : null}
      </p>
      {openQuestion && (
        <p className="rounded-lg border border-unknown/20 bg-unknown-soft/60 px-3 py-2 text-sm text-ink/90">
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
        <pre className="overflow-x-auto rounded-lg border border-border/70 bg-paper px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
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
  const typeLabel = TYPE_LABEL[test.type] ?? test.type.replace(/_/g, " ");

  return (
    <article className="surface fade-up p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-primary/80">
            {test.test_id} · {typeLabel}
          </div>
          <h2 className="mt-1.5 font-serif text-xl text-ink sm:text-2xl">{test.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t(beatKey) || test.expected_behavior}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-border/80 bg-paper px-4 py-2.5 text-center">
            <div className="font-mono text-2xl font-semibold tabular-nums text-ink">{affected.length}</div>
            <div className="eyebrow mt-0.5 flex items-center justify-center gap-1">
              <Building2 className="size-3" /> {t("changes.affectedCount")}
            </div>
          </div>
          {result?.conflict_flag_address_ids && (
            <div className="rounded-xl border border-conflict/25 bg-conflict-soft px-4 py-2.5 text-center">
              <div className="font-mono text-2xl font-semibold tabular-nums text-conflict">{conflicts.length}</div>
              <div className="eyebrow mt-0.5 flex items-center justify-center gap-1">
                <GitMerge className="size-3" /> {t("changes.reviewCount")}
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

      {result && focus === "scope" && (
        <div className="mt-5">
          <ScopeStory affected={affected} addresses={addresses} />
        </div>
      )}

      {result && focus === "failed" && (
        <div className="mt-5 rounded-xl border border-dashed bg-paper px-4 py-3 text-sm text-muted-foreground">
          {t("changes.failedNote")}
        </div>
      )}

      {result?.notes && (
        <ChangeNotes notes={result.notes} affected={affected.length} conflicts={conflicts.length} />
      )}

      {result && (
        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-serif text-base text-ink">{t("changes.affected")}</div>
            <div className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {test.rule_ids.join(" · ")}
            </div>
          </div>
          <AffectedPropertiesTable
            ids={affected}
            addresses={addresses}
            result={result}
            conflicts={conflicts}
            asOfLink={lookupAsOf}
          />
        </div>
      )}
    </article>
  );
}
