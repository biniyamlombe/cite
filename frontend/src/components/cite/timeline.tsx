import type { LookupResponse } from "@/lib/cite/types";
import { useLocale, useT } from "@/lib/i18n";
import { fmtDate } from "@/lib/cite/labels";
import { StatusBadge } from "./status";

/** Effective-date timeline built from the dates the backend returned. */
export function EffectiveTimeline({ data }: { data: LookupResponse }) {
  const t = useT();
  const { locale } = useLocale();
  const items = data.results
    .filter((r) => r.rule?.effective_date)
    .map((r) => ({
      id: r.team_rule_id,
      date: r.rule!.effective_date!,
      title: r.rule!.title,
      result: r.result,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return null;
  const asOfIdx = items.findIndex((i) => i.date > data.as_of);
  const marker = asOfIdx === -1 ? items.length : asOfIdx;
  return (
    <section className="surface p-5">
      <h3 className="eyebrow mb-4">{t("timeline.title")}</h3>
      <ol className="relative ml-2 border-l">
        {items.map((it, i) => (
          <li key={it.id}>
            {i === marker && (
              <AsOfMarker asOf={data.as_of} locale={locale} label={t("timeline.asOf")} />
            )}
            <div className={`relative pb-4 pl-5 ${it.date > data.as_of ? "opacity-80" : ""}`}>
              <span
                className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${it.date > data.as_of ? "border border-ring bg-background" : "bg-primary"}`}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtDate(it.date, locale)}
                </span>
                <span className="text-sm text-ink">{it.title}</span>
                <StatusBadge value={it.result} />
              </div>
            </div>
          </li>
        ))}
        {marker === items.length && (
          <li>
            <AsOfMarker asOf={data.as_of} locale={locale} label={t("timeline.asOf")} />
          </li>
        )}
      </ol>
    </section>
  );
}

function AsOfMarker({ asOf, locale, label }: { asOf: string; locale: string; label: string }) {
  return (
    <div className="relative mb-4 pl-5">
      <span className="absolute -left-[7px] top-1 size-3.5 rounded-sm bg-ink" />
      <span className="font-mono text-xs font-medium text-ink">
        {label} {fmtDate(asOf, locale)}
      </span>
    </div>
  );
}
