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
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:eyebrow">
              <th>{t("changes.col.address")}</th>
              <th>{t("changes.col.jurisdiction")}</th>
              <th>{t("changes.col.before")}</th>
              <th>{t("changes.col.after")}</th>
              <th>{t("changes.col.review")}</th>
              <th className="print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((id) => {
              const a = addresses.find((x) => x.address_id === id);
              return (
                <tr key={id} className="bg-card [&>td]:px-3 [&>td]:py-2.5">
                  <td>
                    <div className="text-ink">{a?.street_address ?? id}</div>
                    <div className="font-mono text-xs text-muted-foreground">{id}</div>
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
                      className="text-xs font-medium text-primary hover:underline"
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

  return (
    <article className="surface fade-up p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">
            {test.test_id} · {test.type.replace(/_/g, " ")}
          </div>
          <h2 className="mt-1.5 font-serif text-xl text-ink sm:text-2xl">{test.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t(beatKey) || test.expected_behavior}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-md border bg-paper px-4 py-2.5 text-center">
            <div className="font-mono text-2xl font-semibold tabular-nums text-ink">{affected.length}</div>
            <div className="eyebrow mt-0.5 flex items-center justify-center gap-1">
              <Building2 className="size-3" /> {t("changes.affectedCount")}
            </div>
          </div>
          {result?.conflict_flag_address_ids && (
            <div className="rounded-md border border-conflict/25 bg-conflict-soft px-4 py-2.5 text-center">
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
        <div className="mt-5 rounded-md border border-dashed bg-paper px-4 py-3 text-sm text-muted-foreground">
          {t("changes.failedNote")}
        </div>
      )}

      <div className="mt-4 font-mono text-xs text-muted-foreground">
        {t("changes.rulesMeta")}: {test.rule_ids.join(", ")}
        {test.as_of && (
          <>
            {" "}
            · {t("changes.asOfMeta")} {test.as_of}
          </>
        )}
      </div>

      {result?.notes && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/85">{result.notes}</p>
      )}

      {result && (
        <div className="mt-5 space-y-2">
          <div className="eyebrow">{t("changes.affected")}</div>
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
