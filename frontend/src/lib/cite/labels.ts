import type { Category, LookupResultValue, RuleStatus } from "./types";

/** English fallbacks for non-React callers; UI should prefer useLabels() / useT(). */
export const RESULT_LABEL: Record<LookupResultValue, string> = {
  applies: "Appears to apply",
  unknown: "Can't determine yet",
  superseded: "Replaced by a local rule",
  not_yet_effective: "Not in effect yet",
  pending: "Still pending",
  does_not_apply: "Does not appear to apply",
};

export const RESULT_ORDER: LookupResultValue[] = [
  "applies",
  "unknown",
  "not_yet_effective",
  "pending",
  "superseded",
  "does_not_apply",
];

export const STATUS_LABEL: Record<RuleStatus, string> = {
  in_force: "In force",
  not_yet_effective: "Not yet effective",
  pending: "Pending",
  failed: "Failed",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  rent_increase_limits: "Rent increase limits",
  just_cause_eviction: "Just-cause eviction",
  security_deposits: "Security deposits",
  application_screening_fees: "Application & screening fees",
  screening_restrictions: "Screening restrictions",
  algorithmic_rent_setting: "Algorithmic rent setting",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as Category[];

export type ConfidenceBand = "high" | "medium" | "low";

/** Display bands for extraction confidence (no legal logic). */
export function confidenceBand(value?: number | null): ConfidenceBand | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 0.5) return "low";
  if (value < 0.85) return "medium";
  return "high";
}

/** Unambiguous legal dates: textual month in the active locale (never MM/DD vs DD/MM). */
export function fmtDate(d?: string | null, locale: string = "en-US") {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T12:00:00Z` : d);
  if (isNaN(dt.getTime())) return d;
  const tag = locale.startsWith("es") ? "es-US" : "en-US";
  return dt.toLocaleDateString(tag, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function coverageText(c: unknown): string | null {
  if (!c) return null;
  if (typeof c === "string") return c;
  if (
    typeof c === "object" &&
    c &&
    "text" in c &&
    typeof (c as { text?: unknown }).text === "string"
  )
    return (c as { text: string }).text;
  return null;
}

/** Display-only humanization of a backend status string (no logic). Prefer useT in UI. */
export function humanStatus(s?: string) {
  if (!s) return "—";
  return (
    (RESULT_LABEL as Record<string, string>)[s] ??
    (STATUS_LABEL as Record<string, string>)[s] ??
    s.replace(/_/g, " ")
  );
}
