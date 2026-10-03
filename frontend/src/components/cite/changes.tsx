import { Building2, GitMerge } from "lucide-react";
import type { AddressRow, ChangeResult, ChangeTest } from "@/lib/cite/types";
import { BeforeAfterStatus, StatusBadge } from "./status";

export function AffectedPropertiesTable({
  ids, addresses, result, conflicts,
}: { ids: string[]; addresses: AddressRow[]; result: ChangeResult; conflicts?: string[] | undefined }) {
  if (ids.length === 0)
    return <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No properties affected.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:eyebrow">
            <th>Address</th><th>Jurisdiction</th><th>Before</th><th>After</th><th>Review</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ids.map((id) => {
            const a = addresses.find((x) => x.address_id === id);
            return (
              <tr key={id} className="bg-card [&>td]:px-3 [&>td]:py-2.5">
                <td>
                  <div className="text-ink">{a?.street_address ?? id}</div>
                  <div className="font-mono text-xs text-muted-foreground">{id}</div>
                </td>
                <td className="text-muted-foreground">{a ? `${a.legal_city ?? a.postal_city}, ${a.state}` : "—"}</td>
                <td>{result.before_status ? <StatusBadge value={result.before_status} /> : "—"}</td>
                <td>{result.after_status ? <StatusBadge value={result.after_status} /> : "—"}</td>
                <td>{conflicts?.includes(id) ? <StatusBadge value="conflict" label="Conflict" /> : <span className="text-muted-foreground">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChangeImpactCard({ test, result, addresses }: { test: ChangeTest; result?: ChangeResult | undefined; addresses: AddressRow[] }) {
  const affected = result?.affected_address_ids ?? [];
  const conflicts = result?.conflict_flag_address_ids ?? [];
  return (
    <article className="surface fade-up p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">{test.test_id} · {test.type.replace(/_/g, " ")}</div>
          <h3 className="mt-1.5 font-serif text-xl text-ink">{test.title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{test.expected_behavior}</p>
          <div className="mt-2 font-mono text-xs text-muted-foreground">Rules: {test.rule_ids.join(", ")}</div>
        </div>
        <div className="flex gap-3">
          <div className="rounded-md border bg-paper px-4 py-2 text-center">
            <div className="font-mono text-2xl font-semibold tabular-nums text-ink">{affected.length}</div>
            <div className="eyebrow flex items-center gap-1"><Building2 className="size-3" />Affected</div>
          </div>
          {result?.conflict_flag_address_ids && (
            <div className="rounded-md border border-conflict/25 bg-conflict-soft px-4 py-2 text-center">
              <div className="font-mono text-2xl font-semibold tabular-nums text-conflict">{conflicts.length}</div>
              <div className="eyebrow flex items-center gap-1"><GitMerge className="size-3" />Review</div>
            </div>
          )}
        </div>
      </div>
      {result && (result.before_status || result.after_status) && (
        <div className="mt-5">
          <BeforeAfterStatus beforeDate={test.as_of_before} afterDate={test.as_of_after} before={result.before_status} after={result.after_status} />
        </div>
      )}
      {result?.notes && <p className="mt-4 text-sm text-foreground/85">{result.notes}</p>}
      {result && <div className="mt-4"><AffectedPropertiesTable ids={affected} addresses={addresses} result={result} conflicts={conflicts} /></div>}
    </article>
  );
}
