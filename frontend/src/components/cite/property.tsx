import { CalendarDays, ChevronRight, MapPin, TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { LookupResponse } from "@/lib/cite/types";

export function JurisdictionStack({ state, county, city }: { state: string; county: string; city: string }) {
  const parts = [state, county, city].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 opacity-50" />}
          <span className={i === parts.length - 1 ? "text-ink font-medium" : ""}>{p}</span>
        </span>
      ))}
    </div>
  );
}

export function PropertyFacts({ yearBuilt, units, legalCity }: { yearBuilt?: string | undefined; units?: string | undefined; legalCity?: string | undefined }) {
  const t = useT();
  const facts = [
    [t("fact.yearBuilt"), yearBuilt],
    [t("fact.units"), units],
    ...(legalCity !== undefined ? [[t("fact.legalCity"), legalCity]] : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
      {facts.map(([k, v]) => (
        <div key={k} className="bg-card px-3 py-2.5 last:odd:col-span-2 sm:last:odd:col-span-1">
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AsOfDate({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  const t = useT();
  return (
    <label className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
      <CalendarDays className="size-4 text-muted-foreground" />
      <span className="eyebrow">{t("fact.asOf")}</span>
      {onChange ? (
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="bg-transparent font-mono text-sm text-ink outline-none"
        />
      ) : (
        <span className="font-mono text-ink">{value}</span>
      )}
    </label>
  );
}

export function PropertySummary({ data, asOf, onAsOf }: { data: LookupResponse; asOf: string; onAsOf: (v: string) => void }) {
  const t = useT();
  const { address: a, jurisdiction: j } = data;
  const differs = j.city && a.postal_city && j.city.toLowerCase() !== a.postal_city.toLowerCase();
  return (
    <section className="surface fade-up p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow flex items-center gap-1.5">
            <MapPin className="size-3" /> {t("fact.property")} · {a.address_id}
          </div>
          <h1 className="mt-2 font-serif text-2xl tracking-[-0.025em] text-ink sm:text-[2rem]">{a.street_address}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {a.postal_city}, {a.state} {a.zip}
          </p>
          {differs && (
            <div className="mt-3 rounded-md border border-primary/25 bg-accent px-3 py-2.5">
              <div className="text-xs font-medium text-accent-foreground">
                {t("postal.remap")} “{a.postal_city}” → {t("postal.toLegal")}{" "}
                <strong className="text-ink">{j.city}</strong>
              </div>
              <p className="mt-1 text-xs text-accent-foreground/90">{t("postal.remapHint")}</p>
            </div>
          )}
          <div className="mt-3"><JurisdictionStack state={j.state} county={j.county} city={j.city} /></div>
        </div>
        <AsOfDate value={asOf} onChange={onAsOf} />
      </div>
      <div className="mt-5"><PropertyFacts yearBuilt={a.year_built} units={a.units} legalCity={j.city} /></div>
      {j.trusted === false && (
        <div className="mt-4 flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-unknown" />
          <p>
            Legal city is an <strong>{t("untrusted.title")}</strong>. {t("untrusted.body")}
          </p>
        </div>
      )}
    </section>
  );
}
