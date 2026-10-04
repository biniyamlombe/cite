import type { SupportedLocale } from "./locale.js";
import { GLOSSARY_VERSION, TRANSLATION_POLICY_VERSION } from "./locale.js";

/** Browser-safe content fingerprint (not a cryptographic guarantee). */
export function contentHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Patterns that must survive translation unchanged. */
export const PROTECTED_TOKEN_PATTERNS: RegExp[] = [
  /\bAB\s?\d+\b/gi,
  /\bSB\s?\d+\b/gi,
  /\bS\.\d+\b/g,
  /\bH\.\d+\b/g,
  /\bT[1-6]\b/g,
  /\bD\d{3}\b/g,
  /\bA\d{4}\b/g,
  /\br-\d{4}\b/gi,
  /\bhttps?:\/\/\S+/gi,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /§\s*[\d.]+(?:\([a-z0-9]+\))*/gi,
  /\bN\.J\.\b/g,
  /\bCA\b/g,
  /\bNJ\b/g,
  /\bMA\b/g,
  /\bFAIR Act\b/g,
  /\bRSO\b/g,
  /\bEllis Act\b/g,
  /\$\d+(?:,\d{3})*(?:\.\d+)?/g,
  /\b\d+(?:\.\d+)?%\b/g,
];

export type ProtectedToken = { placeholder: string; value: string };

/** Replace protected spans with placeholders before machine translation. */
export function protectTokens(source: string): { text: string; tokens: ProtectedToken[] } {
  let text = source;
  const tokens: ProtectedToken[] = [];
  let i = 0;
  for (const pattern of PROTECTED_TOKEN_PATTERNS) {
    text = text.replace(pattern, (match) => {
      const placeholder = `__PT${i++}__`;
      tokens.push({ placeholder, value: match });
      return placeholder;
    });
  }
  return { text, tokens };
}

export function restoreTokens(text: string, tokens: ProtectedToken[]): string {
  let out = text;
  for (const { placeholder, value } of tokens) {
    out = out.split(placeholder).join(value);
  }
  return out;
}

/** True when every protected value from the source still appears in the candidate. */
export function protectedTokensIntact(source: string, candidate: string): boolean {
  const { tokens } = protectTokens(source);
  return tokens.every((t) => candidate.includes(t.value));
}

export type TranslationRiskFactors = {
  legal_terms: boolean;
  dates_numbers_citations: boolean;
  negation: boolean;
  exceptions: boolean;
  conditionality: boolean;
  conflict: boolean;
  pending_or_future: boolean;
  long_complex: boolean;
  missing_glossary: boolean;
};

const LEGAL_TERM_RE =
  /\b(just[- ]cause|rent control|rent stabilization|eviction|exemption|preempt|ordinance|statute|effective|pending|repealed|struck)\b/i;
const NEGATION_RE = /\b(not|no|never|without|unless|except)\b/i;
const EXCEPTION_RE = /\b(except|exemption|exclu|unless|provided that)\b/i;
const CONDITIONAL_RE = /\b(may|might|if|when|where|depends|could|should|must)\b/i;
const PENDING_RE = /\b(pending|not yet effective|not yet in effect|if enacted|ballot|failed|struck)\b/i;
const CONFLICT_RE = /\b(conflict|overlap|preempt|supersed)/i;
const CITATION_RE =
  /(§|\bAB\s?\d+|\bSB\s?\d+|\b\d{4}-\d{2}-\d{2}\b|\$\d+|\d+%|https?:\/\/)/i;

export function assessTranslationRisk(
  source: string,
  opts?: { conflictFlag?: boolean; glossaryMiss?: boolean },
): { score: number; level: "low" | "medium" | "high"; factors: TranslationRiskFactors } {
  const factors: TranslationRiskFactors = {
    legal_terms: LEGAL_TERM_RE.test(source),
    dates_numbers_citations: CITATION_RE.test(source),
    negation: NEGATION_RE.test(source),
    exceptions: EXCEPTION_RE.test(source),
    conditionality: CONDITIONAL_RE.test(source),
    conflict: Boolean(opts?.conflictFlag) || CONFLICT_RE.test(source),
    pending_or_future: PENDING_RE.test(source),
    long_complex: source.length > 280 || (source.match(/[,;:—]/g)?.length ?? 0) > 4,
    missing_glossary: Boolean(opts?.glossaryMiss),
  };
  let score = 0;
  if (factors.legal_terms) score += 2;
  if (factors.dates_numbers_citations) score += 2;
  if (factors.negation) score += 2;
  if (factors.exceptions) score += 2;
  if (factors.conditionality) score += 2;
  if (factors.conflict) score += 3;
  if (factors.pending_or_future) score += 3;
  if (factors.long_complex) score += 1;
  if (factors.missing_glossary) score += 2;
  const level = score >= 8 ? "high" : score >= 4 ? "medium" : "low";
  return { score, level, factors };
}

/** Reject unsafe status/applicability transformations in Spanish. */
export function hasUnsafeStatusDrift(sourceEn: string, candidateEs: string): string[] {
  const issues: string[] = [];
  const en = sourceEn.toLowerCase();
  const es = candidateEs.toLowerCase();

  if (/\bunknown\b/.test(en) || /could not determine|cannot determine|missing/.test(en)) {
    if (
      /\bno aplica\b/.test(es) ||
      /\bno parece aplicar\b/.test(es) ||
      /\bno existe\b/.test(es) ||
      /\bno está permitido\b/.test(es)
    ) {
      issues.push("unknown_mapped_to_does_not_apply");
    }
  }
  if (/\bpending\b/.test(en) || /not yet effective|not in force/.test(en)) {
    if (/\bvigen(te|cia)\b/.test(es) && !/aún no|no entra|pendiente|no es ley/.test(es)) {
      issues.push("pending_presented_as_in_force");
    }
  }
  if (/\bfailed\b|\bstruck\b/.test(en)) {
    if (/\bvigen(te|cia)\b/.test(es) || /\baplica\b/.test(es)) {
      issues.push("failed_presented_as_operative");
    }
  }
  if (/\bmay\b/.test(en) && /\bdebe\b/.test(es) && !/\bpuede\b/.test(es)) {
    issues.push("may_strengthened_to_must");
  }
  return issues;
}

export function baseTranslationMeta(opts: {
  locale: SupportedLocale;
  content_type:
    | "ui"
    | "plain_language_summary"
    | "source_quote_translation"
    | "warning"
    | "disclaimer"
    | "scenario_explanation"
    | "status_label"
    | "error";
  translation_status:
    | "human_reviewed"
    | "machine_generated"
    | "source_official_translation"
    | "untranslated"
    | "not_applicable"
    | "not_available";
  sourceText: string;
  translatedText?: string | null;
  requires_human_review?: boolean;
  quality_flags?: string[];
  provider?: string | null;
}) {
  return {
    locale: opts.locale,
    content_type: opts.content_type,
    translation_status: opts.translation_status,
    source_language: "en" as const,
    authoritative_language: "en" as const,
    translation_provider: opts.provider ?? (opts.translation_status === "machine_generated" ? "cite-template-i18n" : null),
    translation_model_or_version:
      opts.translation_status === "machine_generated" ? `template-${TRANSLATION_POLICY_VERSION}` : null,
    translated_at: opts.translatedText ? new Date().toISOString() : null,
    reviewed_by: null,
    reviewed_at: null,
    quality_flags: opts.quality_flags ?? [],
    original_content_hash: contentHash(opts.sourceText),
    translation_content_hash: opts.translatedText ? contentHash(opts.translatedText) : undefined,
    glossary_version: GLOSSARY_VERSION,
    translation_policy_version: TRANSLATION_POLICY_VERSION,
    requires_human_review: opts.requires_human_review ?? false,
  };
}

/**
 * Deterministic Spanish rendering for known explanation templates.
 * Preserves titles, citations, dates, and city/state tokens.
 * Returns null when no safe template matches (caller must keep English).
 */
export function translateExplanationTemplate(
  explanation: string,
): { text: string; quality_flags: string[] } | null {
  const flags: string[] = [];
  let m: RegExpMatchArray | null;

  m = explanation.match(
    /^(.+?) covers this address in (.+?), ([A-Z]{2}) as of (\d{4}-\d{2}-\d{2})\. (.+)$/,
  );
  if (m) {
    return {
      text: `${m[1]} parece cubrir esta dirección en ${m[2]}, ${m[3]}, a la fecha ${m[4]}. ${m[5]}`,
      quality_flags: ["template:covers_address", ...flags],
    };
  }

  if (
    explanation.includes(
      "Coverage or exemption may depend on unit count and/or owner type; units and owner identity are not available for this address.",
    )
  ) {
    return {
      text: "La cobertura o una exención puede depender del número de unidades y/o del tipo de propietario; el número de unidades y la identidad del propietario no están disponibles para esta dirección.",
      quality_flags: ["template:missing_units_owner", "high_risk"],
    };
  }

  m = explanation.match(/^(.+?) is pending legislation, not in force as of (\d{4}-\d{2}-\d{2})\.$/);
  if (m) {
    return {
      text: `${m[1]} es legislación pendiente; no está en vigor a la fecha ${m[2]}.`,
      quality_flags: ["template:pending", "high_risk"],
    };
  }

  m = explanation.match(
    /^(.+?) is enacted but not effective until (.+?) \(query date (\d{4}-\d{2}-\d{2})\)\.$/,
  );
  if (m) {
    return {
      text: `${m[1]} fue aprobada, pero aún no entra en vigor hasta ${m[2]} (fecha de consulta ${m[3]}).`,
      quality_flags: ["template:not_yet_effective", "high_risk"],
    };
  }

  m = explanation.match(
    /^(.+?) is recorded as failed\/struck and is not treated as operative law as of (\d{4}-\d{2}-\d{2})\.$/,
  );
  if (m) {
    return {
      text: `${m[1]} consta como rechazada o anulada y no se trata como ley operativa a la fecha ${m[2]}.`,
      quality_flags: ["template:failed", "high_risk"],
    };
  }

  m = explanation.match(
    /^(.+?) coverage conditions are not met for this address as of (\d{4}-\d{2}-\d{2}) \(e\.g\. year built, unit count, or exemption\)\.$/,
  );
  if (m) {
    return {
      text: `Las condiciones de cobertura de ${m[1]} no parecen cumplirse para esta dirección a la fecha ${m[2]} (p. ej. año de construcción, número de unidades o exención).`,
      quality_flags: ["template:does_not_apply"],
    };
  }

  m = explanation.match(/^(.+?) is superseded by local rent control for this address\.(.*)$/);
  if (m) {
    return {
      text: `${m[1]} queda sustituida por el control de rentas local para esta dirección.${m[2] ?? ""}`.trim(),
      quality_flags: ["template:superseded"],
    };
  }

  if (explanation.startsWith("Only the building year is known")) {
    return {
      text: "Solo se conoce el año del edificio; se necesita la fecha de producción en el límite de 15 años.",
      quality_flags: ["template:boundary_year", "high_risk"],
    };
  }

  if (explanation.startsWith("Local rent coverage is unresolved")) {
    return {
      text: "La cobertura de renta local no está resuelta; con los hechos disponibles de la propiedad no se puede determinar si el tope estatal queda desplazado.",
      quality_flags: ["template:unresolved_local_rent", "high_risk"],
    };
  }

  m = explanation.match(
    /^Coverage is limited to buildings built before (.+?); year_built is missing\.$/,
  );
  if (m) {
    return {
      text: `La cobertura se limita a edificios construidos antes de ${m[1]}; falta el año de construcción.`,
      quality_flags: ["template:missing_year", "high_risk"],
    };
  }

  // Open-question suffix: keep English note clearly labeled.
  if (explanation.includes("Open question:")) {
    const [body, ...rest] = explanation.split("Open question:");
    const translatedBody = body ? translateExplanationTemplate(body.trim()) : null;
    if (translatedBody) {
      return {
        text: `${translatedBody.text} Pregunta jurídica abierta (texto original en inglés): ${rest.join("Open question:").trim()}`,
        quality_flags: [...translatedBody.quality_flags, "open_question_en_retained", "high_risk"],
      };
    }
  }

  return null;
}
