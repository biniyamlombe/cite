import { CalendarDays, ChevronRight, MapPin, TriangleAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import type { LookupResponse } from "@/lib/cite/types";
import { FactCorrection } from "@/components/cite/fact-correction";
import { isStretchAddress, stretchDemoTip } from "@/lib/cite/stretch";

export function JurisdictionStack({
  state,
  county,
  city,
  countyFips,
  placeGeoid,
  status,
}: {
  state: string;
  county: string;
  city: string;
  countyFips?: string | null;
  placeGeoid?: string | null;
  status?: string | null;
}) {
  const parts = [state, county, city].filter(Boolean);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 opacity-50" />}
            <span className={i === parts.length - 1 ? "text-ink font-medium" : ""}>{p}</span>
          </span>
        ))}
      </div>
      {(countyFips || placeGeoid || status) && (
        <div className="font-mono text-[11px] text-muted-foreground/90">
          {[
            status ? `status=${status}` : null,
            countyFips ? `county_fips=${countyFips}` : null,
            placeGeoid ? `place_geoid=${placeGeoid}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}

export function PropertyFacts({
  yearBuilt,
  units,
  legalCity,
}: {
  yearBuilt?: string | undefined;
  units?: string | undefined;
  legalCity?: string | undefined;
}) {
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
    <label className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring">
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

function StretchCallout({ addressId, asOf }: { addressId: string; asOf: string }) {
  const t = useT();
  const tip = stretchDemoTip(addressId);
  const tipKey =
    tip === "applies"
      ? "stretch.tip.applies"
      : tip === "exempt"
        ? "stretch.tip.exempt"
        : "stretch.tip.generic";
  const compareId = addressId.toUpperCase() === "SA0003" ? "SA0001" : "SA0003";
  return (
    <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">
        {t("stretch.title")}
      </div>
      <p className="mt-1 text-xs text-foreground/85">{t("stretch.body")}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink/90">{t(tipKey)}</p>
      <Link
        to="/"
        search={{ address: compareId, as_of: asOf }}
        className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
      >
        {t("stretch.compare")}
      </Link>
    </div>
  );
}

export function PropertySummary({
  data,
  asOf,
  onAsOf,
}: {
  data: LookupResponse;
  asOf: string;
  onAsOf: (v: string) => void;
}) {
  const t = useT();
  const { address: a, jurisdiction: j } = data;
  const differs = j.city && a.postal_city && j.city.toLowerCase() !== a.postal_city.toLowerCase();
  const stretch = isStretchAddress(a.address_id);
  return (
    <section className="surface fade-up p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow flex flex-wrap items-center gap-1.5">
            <MapPin className="size-3" /> {t("fact.property")} · {a.address_id}
            {stretch ? (
              <span className="inline-flex items-center rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {t("stretch.badge")}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 font-serif text-2xl tracking-[-0.025em] text-ink sm:text-[2rem]">
            {a.street_address}
          </h1>
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
          {stretch ? <StretchCallout addressId={a.address_id} asOf={asOf} /> : null}
          <div className="mt-3">
            <JurisdictionStack
              state={j.state}
              county={j.county}
              city={j.city}
              countyFips={j.county_fips ?? null}
              placeGeoid={j.place_geoid ?? null}
              status={j.status ?? null}
            />
          </div>
        </div>
        <AsOfDate value={asOf} onChange={onAsOf} />
      </div>
      <div className="mt-5">
        <PropertyFacts
          yearBuilt={
            data.building_facts?.year_built != null
              ? String(data.building_facts.year_built)
              : a.year_built
          }
          units={
            data.building_facts?.unit_count != null
              ? String(data.building_facts.unit_count)
              : a.units
          }
          legalCity={j.city}
        />
      </div>
      <FactCorrection data={data} />
      {j.trusted === false && (
        <div className="mt-4 flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-unknown" />
          <p>
            {t("untrusted.prefix")} <strong>{t("untrusted.title")}</strong>. {t("untrusted.body")}
          </p>
        </div>
      )}
    </section>
  );
}
