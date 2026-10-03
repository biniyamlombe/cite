import { CATEGORY_LABELS, type RuleCategory } from "@rhl/shared";

export type Locale = "en" | "es";

const CATEGORY_LABELS_ES: Record<RuleCategory, string> = {
  rent_increase_limits: "Límites de aumento de renta",
  just_cause_eviction: "Desalojo con causa justa",
  security_deposits: "Depósitos de seguridad",
  application_screening_fees: "Tarifas de solicitud / investigación",
  screening_restrictions: "Restricciones de investigación",
  algorithmic_rent_setting: "Fijación algorítmica de rentas",
};

const RESULT_LABELS_EN: Record<string, string> = {
  applies: "applies",
  unknown: "unknown",
  superseded: "superseded",
  not_yet_effective: "not yet effective",
  pending: "pending",
};

const RESULT_LABELS_ES: Record<string, string> = {
  applies: "aplica",
  unknown: "desconocido",
  superseded: "reemplazada",
  not_yet_effective: "aún no vigente",
  pending: "pendiente",
};

const LEVEL_LABELS_ES: Record<string, string> = {
  state: "estado",
  city: "ciudad",
};

export const UI = {
  en: {
    disclaimer:
      "Not legal advice — informational tool with citations from a public corpus. Verify with counsel before acting.",
    brandSub: "Hack-Nation × RealPage · Challenge 02",
    navLookup: "Lookup",
    navChanges: "Changes",
    navPipeline: "Pipeline",
    langEn: "EN",
    langEs: "ES",
    lookupTitle: "Which rules apply here?",
    lookupLede:
      "Search a sample multifamily address, set an as-of date, and see jurisdiction-aware rules with exact corpus citations.",
    searchPlaceholder: "Address ID or street (e.g. A0001 or Delongpre)",
    searchAria: "Search addresses",
    asOfAria: "As of date",
    lookUp: "Look up",
    lookingUp: "Looking up…",
    asOf: "As of",
    built: "Built",
    units: "Units",
    noRules: "No matching rules for this address/date.",
    conflictFlag: "Conflict / human review flagged for this answer.",
    lowConfidence: (n: number) =>
      `Low confidence (${n}) — review before relying on this rule.`,
    retrieved: "retrieved",
    confidence: "confidence",
    source: "Source",
    originalEn: "English detail",
    changesTitle: "Law change tracking",
    changesLede:
      "Deterministic tests T1–T5 from the starter pack: which sample addresses each change affects, with as-of before/after where relevant.",
    loadingChanges: "Loading change tests…",
    affected: "affected addresses",
    conflictFlags: "conflict flags",
    before: "Before",
    after: "after",
    rules: "Rules",
    noChangeResults: "No results yet — run npm run changes.",
    pipelineTitle: "Extraction pipeline",
    pipelineLede:
      "Live Module A demo: read one capturable corpus document and emit validated rule records.",
  },
  es: {
    disclaimer:
      "No es asesoría legal — herramienta informativa con citas de un corpus público. Verifique con un abogado antes de actuar.",
    brandSub: "Hack-Nation × RealPage · Desafío 02",
    navLookup: "Consulta",
    navChanges: "Cambios",
    navPipeline: "Extracción",
    langEn: "EN",
    langEs: "ES",
    lookupTitle: "¿Qué reglas aplican aquí?",
    lookupLede:
      "Busque una dirección multifamiliar de muestra, elija una fecha de referencia y vea reglas por jurisdicción con citas exactas del corpus.",
    searchPlaceholder: "ID o calle (p. ej. A0001 o Delongpre)",
    searchAria: "Buscar direcciones",
    asOfAria: "Fecha de referencia",
    lookUp: "Consultar",
    lookingUp: "Consultando…",
    asOf: "Al",
    built: "Construido",
    units: "Unidades",
    noRules: "No hay reglas que coincidan con esta dirección/fecha.",
    conflictFlag:
      "Conflicto / se recomienda revisión humana para esta respuesta.",
    lowConfidence: (n: number) =>
      `Baja confianza (${n}) — revise antes de basarse en esta regla.`,
    retrieved: "recuperado",
    confidence: "confianza",
    source: "Fuente",
    originalEn: "Detalle en inglés",
    changesTitle: "Seguimiento de cambios legales",
    changesLede:
      "Pruebas determinísticas T1–T5 del paquete inicial: qué direcciones de muestra afecta cada cambio, con fechas antes/después cuando aplica.",
    loadingChanges: "Cargando pruebas de cambio…",
    affected: "direcciones afectadas",
    conflictFlags: "marcas de conflicto",
    before: "Antes",
    after: "después",
    rules: "Reglas",
    noChangeResults: "Sin resultados aún — ejecute npm run changes.",
    pipelineTitle: "Pipeline de extracción",
    pipelineLede:
      "Demo en vivo del Módulo A: lee un documento capturable del corpus y emite registros de reglas validados.",
  },
} as const;

export type UiMessages = {
  [K in keyof (typeof UI)["en"]]: (typeof UI)["en"][K];
};

export function categoryLabel(category: string, locale: Locale): string {
  if (locale === "es" && category in CATEGORY_LABELS_ES) {
    return CATEGORY_LABELS_ES[category as RuleCategory];
  }
  return (
    CATEGORY_LABELS[category as RuleCategory] ||
    category.replaceAll("_", " ")
  );
}

export function resultLabel(result: string, locale: Locale): string {
  if (locale === "es") return RESULT_LABELS_ES[result] || result;
  return RESULT_LABELS_EN[result] || result.replaceAll("_", " ");
}

export function levelLabel(level: string, locale: Locale): string {
  if (locale === "es") return LEVEL_LABELS_ES[level] || level;
  return level;
}

/** Plain-language Spanish summary; citations/quotes stay in source English. */
export function plainExplanationEs(options: {
  result: string;
  title: string;
  asOf: string;
  explanationEn: string;
  effectiveDate?: string | null;
}): string {
  const { result, title, asOf, explanationEn, effectiveDate } = options;
  const missing = missingFactEs(explanationEn);

  switch (result) {
    case "applies":
      return `“${title}” aplica a esta dirección al ${asOf}.`;
    case "unknown":
      return missing
        ? `No se puede confirmar si “${title}” aplica: ${missing}.`
        : `No se puede confirmar si “${title}” aplica con los datos disponibles.`;
    case "superseded":
      return `“${title}” queda reemplazada o cede ante una regla más específica/estricta en esta dirección.`;
    case "not_yet_effective":
      return effectiveDate
        ? `“${title}” está aprobada pero aún no vigente hasta ${effectiveDate} (consulta al ${asOf}).`
        : `“${title}” está aprobada pero aún no vigente al ${asOf}.`;
    case "pending":
      return `“${title}” es legislación pendiente, no está en vigor al ${asOf}.`;
    default:
      return explanationEn;
  }
}

function missingFactEs(explanationEn: string): string | null {
  const e = explanationEn.toLowerCase();
  if (e.includes("year_built") || e.includes("year built")) {
    return "falta el año de construcción";
  }
  if (e.includes("certificate of occupancy") || e.includes("coo")) {
    return "falta el certificado de ocupación (o el año límite es ambiguo)";
  }
  if (e.includes("unit") && (e.includes("missing") || e.includes("unknown"))) {
    return "falta el número de unidades";
  }
  if (e.includes("owner") || e.includes("landlord") || e.includes("small-landlord")) {
    return "faltan datos del propietario / excepción de pequeño propietario";
  }
  if (e.includes("missing")) {
    return "faltan hechos de la propiedad en los datos de muestra";
  }
  return null;
}
