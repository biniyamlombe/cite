import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { LookupResponse } from "@/lib/cite/types";
import { cn } from "@/lib/utils";

export function AuditTrailPanel({ data }: { data: LookupResponse }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const meta = data.meta ?? {
    request_id: data.audit?.request_id ?? "—",
    generated_at: data.audit?.generated_at ?? "—",
    as_of_date: data.as_of,
    pipeline_version: data.audit?.pipeline_version ?? "—",
    schema_version: "—",
  };

  return (
    <section className="rounded-md border border-border/80 bg-card/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-ink"
      >
        <span>{open ? t("lookup.auditHide") : t("lookup.auditToggle")}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border/60 px-4 py-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow">request_id</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{meta.request_id}</dd>
            </div>
            <div>
              <dt className="eyebrow">pipeline_version</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{meta.pipeline_version}</dd>
            </div>
            <div>
              <dt className="eyebrow">generated_at</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{meta.generated_at}</dd>
            </div>
            <div>
              <dt className="eyebrow">as_of</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{data.as_of}</dd>
            </div>
            <div>
              <dt className="eyebrow">facts_source</dt>
              <dd className="mt-1 font-mono text-xs text-ink">
                {data.building_facts?.facts_source ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">product_states</dt>
              <dd className="mt-1 font-mono text-xs text-ink">
                {(data.product_states ?? []).join(", ") || "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="eyebrow">jurisdiction</dt>
              <dd className="mt-1 font-mono text-xs text-ink">
                {data.jurisdiction.state} / {data.jurisdiction.county} / {data.jurisdiction.city}
                {data.jurisdiction.county_fips ? ` · FIPS ${data.jurisdiction.county_fips}` : ""}
                {data.jurisdiction.place_geoid ? ` · GEOID ${data.jurisdiction.place_geoid}` : ""}
                {data.jurisdiction.trusted === false ? " · untrusted" : ""}
              </dd>
            </div>
            {(data.warnings?.length ?? 0) > 0 && (
              <div className="sm:col-span-2">
                <dt className="eyebrow">warnings</dt>
                <dd className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {data.warnings!.map((w) => (
                    <div key={w.code}>
                      <span className="font-mono text-ink">{w.code}</span>: {w.user_message}
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}
