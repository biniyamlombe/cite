import { History } from "lucide-react";
import type { LookupResponse, LookupResultValue } from "@/lib/cite/types";
import { useLocale, useT } from "@/lib/i18n";
import { fmtDate } from "@/lib/cite/labels";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status";

type Item = { id: string; title: string; result: LookupResultValue };
type Stop = { date: string; items: Item[] };

/** Partial dates ("2026", "2026-05") sort and plot at their first day. */
function toDay(d: string): string {
  if (/^\d{4}$/.test(d)) return `${d}-01-01`;
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`;
  return d;
}

function shiftDay(iso: string, days: number): string {
  const dt = new Date(`${iso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function epoch(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}

/**
 * Effective-date time travel. Plots only dates the backend returned; jumping
 * re-requests the lookup at that as-of date, so every result shown is the backend's.
 */
export function EffectiveTimeline({
  data,
  onJump,
}: {
  data: LookupResponse;
  onJump?: ((asOf: string) => void) | undefined;
}) {
  const t = useT();
  const { locale } = useLocale();

  const byDate = new Map<string, Item[]>();
  for (const r of data.results) {
    const raw = r.rule?.effective_date;
    if (!raw) continue;
    const day = toDay(raw);
    const list = byDate.get(day) ?? [];
    list.push({ id: r.team_rule_id, title: r.rule!.title, result: r.result });
    byDate.set(day, list);
  }
  const stops: Stop[] = [...byDate.entries()]
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!stops.length) return null;

  const asOf = data.as_of;
  const lo = Math.min(epoch(stops[0]!.date), epoch(asOf));
  const hi = Math.max(epoch(stops[stops.length - 1]!.date), epoch(asOf));
  const span = Math.max(hi - lo, 1);
  const pos = (iso: string) => 2 + ((epoch(iso) - lo) / span) * 96;
  const upcoming = stops.filter((s) => s.date > asOf);

  return (
    <section className="surface p-5" aria-labelledby="time-travel-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="time-travel-title" className="eyebrow flex items-center gap-1.5">
            <History className="size-3.5" aria-hidden />
            {t("timeline.title")}
          </h3>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            {onJump ? t("timeline.hint") : t("timeline.hintStatic")}
          </p>
        </div>
        {upcoming.length > 0 && (
          <span className="rounded-sm border border-future/30 bg-future-soft px-2 py-0.5 font-mono text-[11px] text-future">
            {t("timeline.upcoming", { n: upcoming.length })}
          </span>
        )}
      </div>

      <div className="relative mt-6 mb-8 h-10 print:hidden" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div
          className="absolute top-1/2 h-px bg-primary/60"
          style={{ left: "0%", width: `${pos(asOf)}%` }}
        />
        {stops.map((s) => (
          <button
            key={s.date}
            type="button"
            tabIndex={-1}
            disabled={!onJump}
            onClick={() => onJump?.(s.date)}
            title={`${fmtDate(s.date, locale)} · ${s.items.length}`}
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform",
              s.date > asOf ? "border-2 border-future bg-background" : "bg-primary",
              onJump && "hover:scale-150",
            )}
            style={{ left: `${pos(s.date)}%` }}
          />
        ))}
        <div
          className={cn(
            "absolute top-0 flex flex-col",
            pos(asOf) > 85
              ? "-translate-x-full items-end"
              : pos(asOf) < 15
                ? "items-start"
                : "-translate-x-1/2 items-center",
          )}
          style={{ left: `${pos(asOf)}%` }}
        >
          <span className="h-10 w-0.5 rounded-full bg-ink" />
          <span className="mt-1 whitespace-nowrap font-mono text-[10px] font-medium text-ink">
            {t("timeline.asOf")} {fmtDate(asOf, locale)}
          </span>
        </div>
      </div>

      <ol className="space-y-3">
        {stops.map((s) => {
          const future = s.date > asOf;
          const isToday = s.date === asOf;
          return (
            <li
              key={s.date}
              className={cn(
                "rounded-md border px-3 py-2.5",
                future ? "border-future/25 bg-future-soft/30" : "border-border/70",
                isToday && "ring-1 ring-ink/30",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-ink">
                  {fmtDate(s.date, locale)}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {future ? t("timeline.future") : t("timeline.past")}
                  </span>
                </span>
                {onJump && (
                  <span className="flex gap-1.5 print:hidden">
                    <JumpButton onClick={() => onJump(shiftDay(s.date, -1))}>
                      {t("timeline.dayBefore")}
                    </JumpButton>
                    <JumpButton onClick={() => onJump(s.date)}>{t("timeline.onDate")}</JumpButton>
                  </span>
                )}
              </div>
              <ul className="mt-1.5 space-y-1">
                {s.items.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink">{it.title}</span>
                    <StatusBadge value={it.result} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function JumpButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border/80 bg-paper px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}
