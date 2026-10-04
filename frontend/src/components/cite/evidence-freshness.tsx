import { AlertTriangle, Clock3, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import type { LookupResponse } from "@/lib/cite/types";

/** Metadata visibility only; 30 days is a UI review reminder, not a legal validity rule. */
export function EvidenceFreshness({
  data,
  capturedAt,
}: {
  data: LookupResponse;
  capturedAt?: string;
}) {
  const t = useT();
  const rules = data.results.map((r) => r.rule).filter((r) => r !== null);
  const dated = rules
    .map((r) => (r.retrieved_at ? Date.parse(r.retrieved_at) : NaN))
    .filter(Number.isFinite);
  const missingDate = rules.length - dated.length;
  const oldest = dated.length ? Math.min(...dated) : null;
  const ageDays =
    oldest === null ? null : Math.max(0, Math.floor((Date.now() - oldest) / 86400000));
  const older = ageDays !== null && ageDays > 30;
  const missingLinks = rules.filter((r) => !r.source_url).length;
  const needsAttention = older || missingDate > 0 || missingLinks > 0;

  return (
    <aside
      className={`rounded-md border px-4 py-4 text-sm ${needsAttention ? "border-unknown/40 bg-unknown-soft/30" : "border-border bg-paper/70"}`}
      aria-label={t("freshness.heading")}
    >
      <div className="flex flex-wrap items-center gap-2 font-medium text-ink">
        {needsAttention ? (
          <AlertTriangle className="size-4 text-unknown" />
        ) : (
          <Clock3 className="size-4 text-primary" />
        )}
        {t("freshness.heading")}
        <span className="ml-auto rounded border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {needsAttention ? t("freshness.attention") : t("freshness.dated")}
        </span>
      </div>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        {rules.length === 0 ? (
          t("freshness.noRules")
        ) : oldest === null ? (
          t("freshness.noDates")
        ) : (
          <>
            {t("freshness.oldest")}:{" "}
            <time dateTime={new Date(oldest).toISOString()} className="font-medium text-ink">
              {new Date(oldest).toLocaleString()}
            </time>{" "}
            <span className="font-mono text-xs">
              ({ageDays} {t("freshness.days")})
            </span>
          </>
        )}
        {missingDate > 0 && (
          <span className="block text-unknown">
            {missingDate} {t("freshness.missingDates")}
          </span>
        )}
        {missingLinks > 0 && (
          <span className="block text-unknown">
            {missingLinks} {t("freshness.missingLinks")}
          </span>
        )}
        {capturedAt && (
          <span className="block">
            {t("freshness.captured")}: {new Date(capturedAt).toLocaleString()}
          </span>
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{t("freshness.caveat")}</p>
      <Link
        to="/sources"
        search={{ address: data.address.address_id, as_of: data.as_of }}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {t("freshness.provenance")} <ExternalLink className="size-3" />
      </Link>
    </aside>
  );
}
