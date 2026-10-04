/**
 * Deterministic one-line answers from rule fields.
 * Numbers in headlines must already appear in the rule text — never invented.
 */
import type {
  PlainLanguageFile,
  PlainLanguageRecord,
  ResultHeadline,
  RuleCategory,
  RuleRecord,
  RuleStatus,
  SupportedLocale,
} from "@rhl/shared";
import { PIPELINE_VERSION } from "@rhl/shared";

const NUM = /\d[\d,]*(?:\.\d+)?%?/g;

function numbersIn(...parts: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    for (const m of p.matchAll(NUM)) out.add(m[0].replace(/,/g, ""));
  }
  return out;
}

function assertNoInventedNumbers(
  headline: string,
  rule: RuleRecord,
): string[] {
  const allowed = numbersIn(
    rule.title,
    rule.key_value,
    rule.requirement,
    rule.quoted_span,
    rule.citation,
    rule.effective_date,
  );
  const bad: string[] = [];
  for (const m of headline.matchAll(NUM)) {
    const n = m[0].replace(/,/g, "");
    if (!allowed.has(n)) bad.push(m[0]);
  }
  return bad;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Turn structured key_value into a short phrase — never dump raw JSON into UI. */
export function humanizeKeyValue(
  keyValue: string | null | undefined,
  locale: "en" | "es",
): string | null {
  if (!keyValue?.trim()) return null;
  const raw = keyValue.trim();
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
      const bits: string[] = [];
      const pct =
        obj.increase_percentage ??
        obj.cap_percentage ??
        obj.annual_increase_pct ??
        obj.percentage;
      if (pct != null && String(pct).trim()) {
        const p = String(pct).trim();
        bits.push(p.includes("%") ? p : `${p}%`);
      }
      if (obj.period_start && obj.period_end) {
        bits.push(
          locale === "es"
            ? `${obj.period_start}–${obj.period_end}`
            : `${obj.period_start}–${obj.period_end}`,
        );
      } else if (obj.measurement_period) {
        bits.push(String(obj.measurement_period));
      }
      if (obj.notice_standard) bits.push(String(obj.notice_standard));
      else if (obj.notice_requirement === "Yes" || obj.notice_requirement === true) {
        bits.push(locale === "es" ? "aviso requerido" : "notice required");
      }
      if (obj.occupancy_threshold_months != null) {
        bits.push(
          locale === "es"
            ? `después de ${obj.occupancy_threshold_months} meses`
            : `after ${obj.occupancy_threshold_months} months`,
        );
      }
      if (obj.just_cause_type) bits.push(String(obj.just_cause_type).replace(/_/g, " "));
      if (obj.account_type) bits.push(clip(String(obj.account_type), 48));
      if (obj.statute_of_limitations) {
        bits.push(
          locale === "es"
            ? `plazo ${obj.statute_of_limitations}`
            : `${obj.statute_of_limitations} to sue`,
        );
      }
      if (obj.prohibited_conduct) bits.push(clip(String(obj.prohibited_conduct), 56));
      if (!bits.length) {
        // Prefer a single short scalar over dumping the object.
        for (const v of Object.values(obj)) {
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            bits.push(String(v));
            break;
          }
        }
      }
      return bits.length ? clip(bits.join(" · "), 90) : null;
    } catch {
      return null;
    }
  }
  if (raw.includes("{") || raw.includes("}")) return null;
  return clip(raw, 90);
}

function statusPrefix(
  status: RuleStatus,
  locale: "en" | "es",
): string {
  if (locale === "en") {
    if (status === "pending") return "Pending — ";
    if (status === "not_yet_effective") return "Not yet in force — ";
    if (status === "failed") return "Did not become law — ";
    return "";
  }
  if (status === "pending") return "Pendiente — ";
  if (status === "not_yet_effective") return "Aún no vigente — ";
  if (status === "failed") return "No se convirtió en ley — ";
  return "";
}

function categoryLine(
  rule: RuleRecord,
  locale: "en" | "es",
): { headline: string; why: string } {
  const detail = humanizeKeyValue(rule.key_value, locale);
  const place = rule.jurisdiction;
  const title = clip(rule.title, 64);
  const withDetail = (base: string) => (detail ? `${base}: ${detail}` : base);

  if (locale === "en") {
    switch (rule.category as RuleCategory) {
      case "rent_increase_limits":
        return {
          headline: withDetail(
            detail ? `Rent increases limited` : `Rent increase limits in ${place}`,
          ),
          why: clip(rule.requirement, 220),
        };
      case "just_cause_eviction":
        return {
          headline: withDetail(`Just-cause eviction rules`),
          why: clip(rule.requirement, 220),
        };
      case "security_deposits":
        return {
          headline: withDetail(`Security deposit rules`),
          why: clip(rule.requirement, 220),
        };
      case "application_screening_fees":
        return {
          headline: withDetail(`Application screening fee rules`),
          why: clip(rule.requirement, 220),
        };
      case "screening_restrictions":
        return {
          headline: title.includes("creen")
            ? title
            : `Tenant screening restrictions apply`,
          why: clip(rule.requirement, 220),
        };
      case "algorithmic_rent_setting":
        return {
          headline: withDetail(`Algorithmic rent-setting limits`),
          why: clip(rule.requirement, 220),
        };
      default:
        return { headline: title, why: clip(rule.requirement, 220) };
    }
  }

  switch (rule.category as RuleCategory) {
    case "rent_increase_limits":
      return {
        headline: withDetail(
          detail ? `Límites al aumento de renta` : `Límites al aumento de renta en ${place}`,
        ),
        why: clip(rule.requirement, 240),
      };
    case "just_cause_eviction":
      return {
        headline: withDetail(`Desalojo solo por causa justa`),
        why: clip(rule.requirement, 240),
      };
    case "security_deposits":
      return {
        headline: withDetail(`Reglas de depósito de seguridad`),
        why: clip(rule.requirement, 240),
      };
    case "application_screening_fees":
      return {
        headline: withDetail(`Tarifa de evaluación de solicitud`),
        why: clip(rule.requirement, 240),
      };
    case "screening_restrictions":
      return {
        headline: `Restricciones a la evaluación de inquilinos`,
        why: clip(rule.requirement, 240),
      };
    case "algorithmic_rent_setting":
      return {
        headline: withDetail(`Límites a renta algorítmica`),
        why: clip(rule.requirement, 240),
      };
    default:
      return { headline: title, why: clip(rule.requirement, 240) };
  }
}

export function buildPlainRecord(rule: RuleRecord): PlainLanguageRecord {
  const enCore = categoryLine(rule, "en");
  const esCore = categoryLine(rule, "es");
  let headline_en = clip(
    `${statusPrefix(rule.status, "en")}${enCore.headline}`,
    140,
  );
  let headline_es = clip(
    `${statusPrefix(rule.status, "es")}${esCore.headline}`,
    160,
  );

  // If a number slipped in that is not in source fields, fall back to title-only.
  if (assertNoInventedNumbers(headline_en, rule).length) {
    headline_en = clip(
      `${statusPrefix(rule.status, "en")}${rule.title}`,
      140,
    );
  }
  if (assertNoInventedNumbers(headline_es, rule).length) {
    headline_es = clip(
      `${statusPrefix(rule.status, "es")}${rule.title}`,
      160,
    );
  }

  return {
    team_rule_id: rule.team_rule_id,
    category: rule.category,
    status: rule.status,
    source: "template",
    headline_en,
    headline_es,
    why_en: enCore.why,
    why_es: esCore.why,
  };
}

export function buildPlainLanguageFile(rules: RuleRecord[]): PlainLanguageFile {
  const records: Record<string, PlainLanguageRecord> = {};
  for (const rule of rules) {
    records[rule.team_rule_id] = buildPlainRecord(rule);
  }
  return {
    generated_at: new Date().toISOString(),
    pipeline_version: PIPELINE_VERSION,
    count: Object.keys(records).length,
    records,
  };
}

/** Result-aware card line (still display-only; does not re-evaluate coverage). */
export function headlineForLookup(opts: {
  record: PlainLanguageRecord | undefined;
  result: string;
  locale: SupportedLocale;
  factsMissing?: string[];
}): ResultHeadline | undefined {
  const { record, result, locale, factsMissing } = opts;
  if (!record) return undefined;

  const baseText =
    locale === "es-US" ? record.headline_es : record.headline_en;
  const baseWhy = locale === "es-US" ? record.why_es : record.why_en;

  if (result === "superseded") {
    return {
      text:
        locale === "es-US"
          ? "Cede ante una regla local más específica"
          : "Yields to a more specific local rule",
      why: baseWhy,
      locale,
      authoritative_language: "en",
    };
  }
  if (result === "unknown") {
    const fact = factsMissing?.[0];
    return {
      text:
        locale === "es-US"
          ? fact
            ? `Desconocido sin el dato: ${fact}`
            : "Desconocido — faltan datos del edificio"
          : fact
            ? `Unknown without this fact: ${fact}`
            : "Unknown — building facts are missing",
      why: baseWhy,
      locale,
      authoritative_language: "en",
    };
  }

  return {
    text: baseText,
    why: baseWhy,
    locale,
    authoritative_language: "en",
  };
}
