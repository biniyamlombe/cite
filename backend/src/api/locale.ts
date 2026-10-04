import {
  APPLICABILITY_LABELS,
  DISCLAIMERS,
  INFORMATIONAL_TRANSLATION_NOTICE_ES,
  LOOKUP_RESULT_LABELS,
  SOURCE_QUOTE_NOTICE,
  applicabilityLabel,
  assessTranslationRisk,
  baseTranslationMeta,
  hasUnsafeStatusDrift,
  legalStatusLabel,
  parseLocale,
  protectTokens,
  restoreTokens,
  translateExplanationTemplate,
  type ApiWarning,
  type SupportedLocale,
} from "@rhl/shared";

const WARNING_USER_ES: Record<string, string> = {
  UNTRUSTED_GEOCODE:
    "No pudimos determinar con confianza la ciudad legal. Las normas municipales se omiten hasta que la jurisdicción sea confiable.",
  BUILDING_FACTS_MISSING:
    "Algunas normas necesitan más información del edificio (por ejemplo, año de construcción o número de unidades) antes de poder determinar la cobertura.",
  CONFLICT_REQUIRES_REVIEW:
    "Posible conflicto o ambigüedad: revise las fuentes citadas. Esta herramienta no decide qué norma prevalece.",
  PENDING_NOT_EFFECTIVE:
    "Algunas medidas están pendientes o aún no entran en vigor en la fecha seleccionada y no son ley exigible actual.",
  SOURCE_UNAVAILABLE:
    "El texto primario de la ordenanza local no está disponible en este prototipo. La evidencia citada permanece solo en documentos capturables del corpus.",
  CORPUS_GAP:
    "Las páginas de ordenanzas locales de esta ciudad son solo-enlace o check-terms en el pack. Aún pueden aparecer normas estatales.",
  USER_PROVIDED_FACTS:
    "Los resultados siguientes usan hechos del edificio que usted proporcionó en esta sesión. No son registros públicos verificados.",
};

const ERROR_USER_ES: Record<string, string> = {
  INVALID_AS_OF: "Ingrese una fecha de calendario válida en formato AAAA-MM-DD.",
  ADDRESS_NOT_FOUND:
    "Esa dirección no está en el conjunto de muestra compatible. Pruebe un ID demo como A0005, o busque por calle en una ciudad cubierta.",
  NOT_GEOCODED:
    "La jurisdicción de esta dirección aún no está lista. Reintente después de completar la geocodificación.",
  NO_RULES_LOADED: "Los datos de normas no están cargados. Reintente en breve o contacte al operador.",
};

export function resolveRequestLocale(raw?: string | null): {
  locale: SupportedLocale;
  locale_warning: string | null;
} {
  const parsed = parseLocale(raw);
  if (!parsed.fallback || parsed.requested == null) {
    return { locale: parsed.locale, locale_warning: null };
  }
  if (parsed.locale === "en-US" && parsed.requested && !/^en(-|$)/i.test(parsed.requested)) {
    return {
      locale: parsed.locale,
      locale_warning:
        `Unsupported locale "${parsed.requested}"; fell back to en-US. Supported: en-US, es-US.`,
    };
  }
  if (parsed.locale === "es-US" && parsed.requested.toLowerCase() !== "es-us") {
    return {
      locale: "es-US",
      locale_warning:
        `Locale "${parsed.requested}" mapped to es-US (U.S. Spanish). Generic "es" is accepted as a fallback alias.`,
    };
  }
  return { locale: parsed.locale, locale_warning: null };
}

export function localizedDisclaimer(locale: SupportedLocale): string {
  return DISCLAIMERS[locale];
}

export function localizeWarnings(warnings: ApiWarning[], locale: SupportedLocale): ApiWarning[] {
  if (locale !== "es-US") return warnings;
  return warnings.map((w) => ({
    ...w,
    user_message: WARNING_USER_ES[w.code] ?? w.user_message,
  }));
}

export function localizedErrorUserMessage(
  code: string,
  english: string,
  locale: SupportedLocale,
): string {
  if (locale !== "es-US") return english;
  return ERROR_USER_ES[code] ?? english;
}

export function displayStatusLabel(
  code: string | null | undefined,
  locale: SupportedLocale,
): string | null {
  return legalStatusLabel(code, locale);
}

export function displayApplicabilityLabel(
  code: string | null | undefined,
  locale: SupportedLocale,
): string | null {
  if (!code) return null;
  if (code in APPLICABILITY_LABELS[locale]) {
    return applicabilityLabel(code, locale);
  }
  return LOOKUP_RESULT_LABELS[locale][code] ?? code;
}

export function localizeExplanation(opts: {
  explanation: string;
  locale: SupportedLocale;
  conflictFlag?: boolean;
}): {
  plain_language_summary: {
    text: string;
    translation_status:
      | "human_reviewed"
      | "machine_generated"
      | "untranslated"
      | "not_available";
    authoritative_language: "en";
    source_text_en: string;
    requires_human_review: boolean;
    quality_flags: string[];
  };
  translation: {
    status: "human_reviewed" | "machine_generated" | "not_available" | "untranslated";
    requires_human_review: boolean;
  };
} {
  const { explanation, locale, conflictFlag } = opts;
  if (locale !== "es-US") {
    return {
      plain_language_summary: {
        text: explanation,
        translation_status: "untranslated",
        authoritative_language: "en",
        source_text_en: explanation,
        requires_human_review: false,
        quality_flags: [],
      },
      translation: { status: "untranslated", requires_human_review: false },
    };
  }

  const risk = assessTranslationRisk(explanation, { conflictFlag });
  const templated = translateExplanationTemplate(explanation);
  if (!templated) {
    return {
      plain_language_summary: {
        text: explanation,
        translation_status: "not_available",
        authoritative_language: "en",
        source_text_en: explanation,
        requires_human_review: true,
        quality_flags: ["no_safe_template", `risk:${risk.level}`],
      },
      translation: { status: "not_available", requires_human_review: true },
    };
  }

  const { tokens } = protectTokens(explanation);
  const restored = restoreTokens(templated.text, tokens);
  const drift = hasUnsafeStatusDrift(explanation, restored);
  const quality_flags = [
    ...templated.quality_flags,
    `risk:${risk.level}`,
    ...drift.map((d) => `drift:${d}`),
  ];
  const unsafe = drift.length > 0;
  if (unsafe) {
    return {
      plain_language_summary: {
        text: explanation,
        translation_status: "not_available",
        authoritative_language: "en",
        source_text_en: explanation,
        requires_human_review: true,
        quality_flags,
      },
      translation: { status: "not_available", requires_human_review: true },
    };
  }

  const requires_human_review = risk.level === "high" || quality_flags.includes("high_risk");
  // Provenance retained for audit; not all fields are echoed to the client.
  void baseTranslationMeta({
    locale,
    content_type: "plain_language_summary",
    translation_status: "machine_generated",
    sourceText: explanation,
    translatedText: restored,
    requires_human_review,
    quality_flags,
  });

  return {
    plain_language_summary: {
      text: restored,
      translation_status: "machine_generated",
      authoritative_language: "en",
      source_text_en: explanation,
      requires_human_review,
      quality_flags,
    },
    translation: {
      status: "machine_generated",
      requires_human_review,
    },
  };
}

export function sourceEvidenceBlock(rule: {
  quoted_span?: string | null;
  citation?: string | null;
  source_url?: string | null;
  retrieved_at?: string | null;
} | null, locale: SupportedLocale) {
  const quote = rule?.quoted_span ?? "";
  const retrieval = rule?.retrieved_at?.slice(0, 10) ?? null;
  return {
    official_quote_en: quote,
    informational_translation_es: null as string | null,
    translation_notice:
      locale === "es-US"
        ? INFORMATIONAL_TRANSLATION_NOTICE_ES
        : SOURCE_QUOTE_NOTICE["en-US"],
    citation: rule?.citation ?? null,
    url: rule?.source_url ?? null,
    retrieval_date: retrieval,
  };
}
