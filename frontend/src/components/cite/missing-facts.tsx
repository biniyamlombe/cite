import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { LookupResponse } from "@/lib/cite/types";

export type FactOverrides = {
  yearBuilt?: string | undefined;
  units?: string | undefined;
};

export function collectMissingFacts(data: LookupResponse): string[] {
  const set = new Set<string>();
  for (const r of data.results) {
    for (const f of r.facts_missing ?? []) set.add(f);
  }
  return [...set];
}

export function MissingFactsPanel({
  data,
  overrides,
  onApply,
  onClear,
}: {
  data: LookupResponse;
  overrides: FactOverrides;
  onApply: (next: FactOverrides) => void;
  onClear: () => void;
}) {
  const t = useT();
  const missing = collectMissingFacts(data);
  const editable = missing.filter((f) => f === "year_built" || f === "units");
  const [yearBuilt, setYearBuilt] = useState(
    overrides.yearBuilt ?? (data.address.year_built || ""),
  );
  const [units, setUnits] = useState(overrides.units ?? (data.address.units || ""));

  if (!missing.length && !overrides.yearBuilt && !overrides.units) return null;

  const userProvided = data.building_facts?.facts_source === "user_provided";

  return (
    <section
      className="rounded-md border border-unknown/30 bg-unknown-soft/60 p-4 sm:p-5"
      aria-labelledby="missing-facts-heading"
    >
      <div className="flex gap-2.5">
        <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-unknown" />
        <div className="min-w-0 flex-1">
          <h3 id="missing-facts-heading" className="font-medium text-ink">
            {t("facts.missing.title")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("facts.missing.lede")}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/90">
            {missing.map((f) => (
              <li key={f}>
                <span className="font-mono text-xs">{f}</span>
                {f === "owner_type" ? ` — ${t("facts.owner_type")}` : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {userProvided || overrides.yearBuilt || overrides.units
              ? t("facts.source.user")
              : t("facts.source.corpus")}
          </p>

          {editable.length > 0 && (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const next: FactOverrides = {};
                if (yearBuilt.trim()) next.yearBuilt = yearBuilt.trim();
                if (units.trim()) next.units = units.trim();
                onApply(next);
              }}
            >
              {editable.includes("year_built") && (
                <label className="block text-sm">
                  <span className="font-medium text-ink">{t("facts.year")}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={yearBuilt}
                    onChange={(e) => setYearBuilt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-paper px-3 py-2 font-mono text-sm"
                    autoComplete="off"
                  />
                </label>
              )}
              {editable.includes("units") && (
                <label className="block text-sm">
                  <span className="font-medium text-ink">{t("facts.units")}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-paper px-3 py-2 font-mono text-sm"
                    autoComplete="off"
                  />
                </label>
              )}
              <Button type="submit" className="rounded-full">
                {t("facts.apply")}
              </Button>
              {(overrides.yearBuilt || overrides.units) && (
                <Button type="button" variant="outline" className="rounded-full" onClick={onClear}>
                  {t("facts.clear")}
                </Button>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
