import { z } from "zod";

/** Canonical product locales (BCP-47). */
export const SupportedLocale = z.enum(["en-US", "es-US"]);
export type SupportedLocale = z.infer<typeof SupportedLocale>;

export const DEFAULT_LOCALE: SupportedLocale = "en-US";
export const GLOSSARY_VERSION = "1.0.0";
export const TRANSLATION_POLICY_VERSION = "1.0.0";

/**
 * Normalize Accept-Language / query / storage values to a supported locale.
 * Invalid or unsupported values fall back to en-US.
 */
export function parseLocale(raw?: string | null): {
  locale: SupportedLocale;
  requested: string | null;
  fallback: boolean;
} {
  if (raw == null || String(raw).trim() === "") {
    return { locale: DEFAULT_LOCALE, requested: null, fallback: false };
  }
  const requested = String(raw).trim();
  const primary = requested.split(",")[0]?.trim().split(";")[0]?.trim() ?? requested;
  const lower = primary.toLowerCase();
  if (lower === "en-us" || lower === "en") {
    return { locale: "en-US", requested, fallback: lower === "en" };
  }
  if (lower === "es-us" || lower === "es" || lower.startsWith("es-")) {
    // Generic `es` and other regional Spanish tags map to es-US with documented fallback.
    return { locale: "es-US", requested, fallback: lower !== "es-us" };
  }
  return { locale: DEFAULT_LOCALE, requested, fallback: true };
}

export const TranslationStatus = z.enum([
  "human_reviewed",
  "machine_generated",
  "source_official_translation",
  "untranslated",
  "not_applicable",
  "not_available",
]);
export type TranslationStatus = z.infer<typeof TranslationStatus>;

export const ContentType = z.enum([
  "ui",
  "plain_language_summary",
  "source_quote_translation",
  "warning",
  "disclaimer",
  "scenario_explanation",
  "status_label",
  "error",
]);
export type ContentType = z.infer<typeof ContentType>;

export const TranslationMetaSchema = z.object({
  locale: SupportedLocale,
  content_type: ContentType,
  translation_status: TranslationStatus,
  source_language: z.literal("en"),
  authoritative_language: z.literal("en"),
  translation_provider: z.string().nullable().optional(),
  translation_model_or_version: z.string().nullable().optional(),
  translated_at: z.string().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  quality_flags: z.array(z.string()).default([]),
  original_content_hash: z.string().optional(),
  translation_content_hash: z.string().optional(),
  glossary_version: z.string().optional(),
  translation_policy_version: z.string().optional(),
  requires_human_review: z.boolean().optional(),
});
export type TranslationMeta = z.infer<typeof TranslationMetaSchema>;

export const LocalizedTextSchema = z.object({
  text: z.string(),
  translation: TranslationMetaSchema.optional(),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const DISCLAIMERS: Record<SupportedLocale, string> = {
  "en-US":
    "Not legal advice and not a compliance certification. Based on available public records in this prototype. Verify important decisions with a qualified legal professional.",
  "es-US":
    "No es asesoramiento legal ni una certificación de cumplimiento. Se basa en registros públicos disponibles en este prototipo. Verifique las decisiones importantes con un profesional legal calificado.",
};

export const LEGAL_STATUS_LABELS: Record<
  SupportedLocale,
  Record<"in_force" | "not_yet_effective" | "pending" | "failed", string>
> = {
  "en-US": {
    in_force: "In force",
    not_yet_effective: "Enacted but not yet effective",
    pending: "Pending",
    failed: "Failed or struck",
  },
  "es-US": {
    in_force: "Vigente",
    not_yet_effective: "Aprobada, pero aún no entra en vigor",
    pending: "Pendiente",
    failed: "Rechazada o anulada",
  },
};

export const APPLICABILITY_LABELS: Record<
  SupportedLocale,
  Record<"applies" | "does_not_apply" | "unknown" | "needs_human_review", string>
> = {
  "en-US": {
    applies: "Appears to apply",
    does_not_apply: "Does not appear to apply",
    unknown: "Unknown",
    needs_human_review: "Needs human review",
  },
  "es-US": {
    applies: "Parece aplicar",
    does_not_apply: "No parece aplicar",
    unknown: "No se puede determinar",
    needs_human_review: "Se necesita revisión humana",
  },
};

/** Pack lookup result labels (includes temporal / superseded states). */
export const LOOKUP_RESULT_LABELS: Record<SupportedLocale, Record<string, string>> = {
  "en-US": {
    applies: "Appears to apply",
    unknown: "Unknown",
    superseded: "Superseded",
    not_yet_effective: "Not yet effective",
    pending: "Pending",
    does_not_apply: "Does not appear to apply",
    needs_human_review: "Needs human review",
  },
  "es-US": {
    applies: "Parece aplicar",
    unknown: "No se puede determinar",
    superseded: "Sustituida",
    not_yet_effective: "Aún no entra en vigor",
    pending: "Pendiente",
    does_not_apply: "No parece aplicar",
    needs_human_review: "Se necesita revisión humana",
  },
};

export const SOURCE_QUOTE_NOTICE: Record<SupportedLocale, string> = {
  "en-US": "Original English legal source text. This quotation is authoritative.",
  "es-US":
    "Texto legal original en inglés. Esta cita es la fuente oficial. Cualquier traducción al español es solo informativa.",
};

export const INFORMATIONAL_TRANSLATION_NOTICE_ES =
  "Traducción informativa generada automáticamente; el texto original en inglés es la fuente oficial.";

export function legalStatusLabel(
  code: string | null | undefined,
  locale: SupportedLocale,
): string | null {
  if (!code) return null;
  const table = LEGAL_STATUS_LABELS[locale] as Record<string, string>;
  return table[code] ?? LOOKUP_RESULT_LABELS[locale][code] ?? code;
}

export function applicabilityLabel(
  code: string | null | undefined,
  locale: SupportedLocale,
): string | null {
  if (!code) return null;
  return (
    APPLICABILITY_LABELS[locale][code as keyof (typeof APPLICABILITY_LABELS)["en-US"]] ??
    LOOKUP_RESULT_LABELS[locale][code] ??
    code
  );
}
