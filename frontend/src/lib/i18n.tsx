import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "es";

// UI chrome only. Legal quotations, citations and backend explanations stay in their source language.
const STRINGS = {
  en: {
    "nav.lookup": "Property Lookup",
    "nav.changes": "Change Radar",
    "nav.rules": "Rules",
    "nav.pipeline": "Pipeline",
    "nav.more": "More",
    "nav.portfolio": "Portfolio",
    "nav.bulk": "Bulk",
    "nav.coverage": "Coverage",
    "nav.memos": "Memos",
    "nav.dashboard": "Dashboard",
    "nav.settings": "Team",
    "nav.signin": "Sign in",
    "nav.signout": "Sign out",
    "action.saveMemo": "Save memo",
    "action.saved": "Saved",
    "action.emailAlerts": "Email alerts",
    "action.csv": "Export CSV",
    "action.watch": "Watch",
    "action.watching": "Watching",
    "nav.about": "About",
    "mode.mock": "Demo data",
    "mode.live": "Live API",
    disclaimer: "Not legal advice. Verify important decisions with qualified counsel.",
    "lookup.eyebrow": "Regulatory intelligence for rental housing",
    "lookup.title1": "Know what applies.",
    "lookup.title2": "And why.",
    "lookup.lede":
      "Every conclusion traced to its legal source. Enter a rental property address to see applicable rules, the reasons behind them, and what is about to change.",
    "lookup.label": "Enter a rental property address",
    "lookup.placeholder": "Street address or ID, e.g. A0001, Delongpre",
    "lookup.try": "Try:",
    "lookup.none": "No matching properties.",
    "lookup.philosophy":
      "AI can help structure regulation. Deterministic systems evaluate applicability. Evidence supports the conclusion.",
    "lookup.reading": "Reading order",
    "lookup.stepWhat": "What applies",
    "lookup.stepWhy": "Why it applies",
    "lookup.stepEvidence": "What evidence supports it",
    "lookup.loading": "Evaluating applicability…",
    "lookup.loadingHint": "Resolving jurisdiction, coverage, and citations for this as-of date.",
    "lookup.errorTitle": "Lookup could not be completed",
    "lookup.errorHint": "Try another address or retry shortly.",
    "lookup.retry": "Retry",
    "lookup.summary": "Result summary",
    "lookup.rulesHeading": "Applicable rules",
    "lookup.rulesLede": "Grouped by category. Open a rule for plain-language reason and source evidence.",
    "lookup.emptyRules": "No applicable rules returned",
    "lookup.emptyRulesHint":
      "The evaluation returned no rules for this property on this as-of date. Rules that do not apply are omitted.",
    "lookup.viewEvidence": "View evidence",
    "lookup.why": "Why",
    "lookup.actions": "Actions",
    "action.print": "Print memo",
    "action.share": "Copy link",
    "action.copied": "Copied",
    "action.copyCitation": "Copy citation",
    "action.compare": "Compare dates",
    "action.sources": "Sources",
    "memo.title": "Regulatory applicability memo",
    "memo.generated": "Generated",
    "changes.eyebrow": "Module C · Change tests",
    "changes.title": "Change Radar",
    "changes.lede":
      "Not only what applies today — what will change, when, and which properties are affected.",
    "changes.loading": "Loading change tests…",
    "changes.error": "Could not load change tests.",
    "changes.story": "Before → after story",
    "changes.affected": "Affected properties",
    "changes.noneAffected": "No properties affected.",
    "changes.showAll": "Show all",
    "changes.showFewer": "Show fewer",
    "changes.openLookup": "Open lookup",
    "changes.t6Title": "Hour-16 Cambridge ordinance",
    "changes.t6Body": "Awaiting corpus release. No results until the source document is published.",
    "changes.scope": "Jurisdiction scope",
    "changes.excluded": "Correctly excluded",
    "pipeline.eyebrow": "Pipeline · Module A",
    "pipeline.title": "From legal text to cited rules",
    "pipeline.lede":
      "AI can help structure regulation. Deterministic systems evaluate applicability. Evidence supports the conclusion. Pick a capturable corpus document and run extract.",
    "pipeline.sourceDoc": "Source document",
    "pipeline.run": "Run extract",
    "pipeline.running": "Extracting…",
    "pipeline.empty": "No extract run yet. Choose a document and press Run extract.",
    "pipeline.loadingDocs": "Loading corpus documents…",
    "pipeline.docsError": "Could not load corpus documents.",
    "pipeline.docsCount": "documents available",
    "pipeline.liveCorpus": "Live corpus",
    "pipeline.demoDocs": "Demo documents",
    "pipeline.failed": "Extract failed",
    "pipeline.stepSource": "1 · Source text",
    "pipeline.stepValidation": "2 · Schema validation",
    "pipeline.stepRules": "3 · Structured rules",
    "pipeline.via": "Extract via",
  },
  es: {
    "nav.lookup": "Consulta de propiedad",
    "nav.changes": "Radar de cambios",
    "nav.rules": "Normas",
    "nav.pipeline": "Proceso",
    "nav.more": "Más",
    "nav.portfolio": "Cartera",
    "nav.bulk": "Masivo",
    "nav.coverage": "Cobertura",
    "nav.memos": "Memorandos",
    "nav.dashboard": "Panel",
    "nav.settings": "Equipo",
    "nav.signin": "Iniciar sesión",
    "nav.signout": "Cerrar sesión",
    "action.saveMemo": "Guardar memo",
    "action.saved": "Guardado",
    "action.emailAlerts": "Alertas por correo",
    "action.csv": "Exportar CSV",
    "action.watch": "Seguir",
    "action.watching": "Siguiendo",
    "nav.about": "Acerca de",
    "mode.mock": "Datos de demostración",
    "mode.live": "API en vivo",
    disclaimer: "No es asesoría legal. Verifique las decisiones importantes con un abogado calificado.",
    "lookup.eyebrow": "Inteligencia regulatoria para vivienda de alquiler",
    "lookup.title1": "Sepa qué aplica.",
    "lookup.title2": "Y por qué.",
    "lookup.lede":
      "Cada conclusión vinculada a su fuente legal. Ingrese la dirección de una propiedad de alquiler para ver las normas aplicables, sus motivos y lo que está por cambiar.",
    "lookup.label": "Ingrese la dirección de una propiedad de alquiler",
    "lookup.placeholder": "Dirección o ID, p. ej. A0001, Delongpre",
    "lookup.try": "Pruebe:",
    "lookup.none": "No hay propiedades coincidentes.",
    "lookup.philosophy":
      "La IA puede ayudar a estructurar la regulación. Sistemas deterministas evalúan la aplicabilidad. La evidencia sostiene la conclusión.",
    "lookup.reading": "Orden de lectura",
    "lookup.stepWhat": "Qué aplica",
    "lookup.stepWhy": "Por qué aplica",
    "lookup.stepEvidence": "Qué evidencia lo sostiene",
    "lookup.loading": "Evaluando aplicabilidad…",
    "lookup.loadingHint": "Resolviendo jurisdicción, cobertura y citas para esta fecha de análisis.",
    "lookup.errorTitle": "No se pudo completar la consulta",
    "lookup.errorHint": "Pruebe otra dirección o reintente en breve.",
    "lookup.retry": "Reintentar",
    "lookup.summary": "Resumen de resultados",
    "lookup.rulesHeading": "Normas aplicables",
    "lookup.rulesLede": "Agrupadas por categoría. Abra una norma para ver el motivo y la evidencia.",
    "lookup.emptyRules": "No se devolvieron normas aplicables",
    "lookup.emptyRulesHint":
      "La evaluación no devolvió normas para esta propiedad en esta fecha. Las normas que no aplican se omiten.",
    "lookup.viewEvidence": "Ver evidencia",
    "lookup.why": "Por qué",
    "lookup.actions": "Acciones",
    "action.print": "Imprimir memo",
    "action.share": "Copiar enlace",
    "action.copied": "Copiado",
    "action.copyCitation": "Copiar cita",
    "action.compare": "Comparar fechas",
    "action.sources": "Fuentes",
    "memo.title": "Memorándum de aplicabilidad regulatoria",
    "memo.generated": "Generado",
    "changes.eyebrow": "Módulo C · Pruebas de cambio",
    "changes.title": "Radar de cambios",
    "changes.lede":
      "No solo qué aplica hoy — qué cambiará, cuándo y qué propiedades se verán afectadas.",
    "changes.loading": "Cargando pruebas de cambio…",
    "changes.error": "No se pudieron cargar las pruebas de cambio.",
    "changes.story": "Historia antes → después",
    "changes.affected": "Propiedades afectadas",
    "changes.noneAffected": "Ninguna propiedad afectada.",
    "changes.showAll": "Mostrar todas",
    "changes.showFewer": "Mostrar menos",
    "changes.openLookup": "Abrir consulta",
    "changes.t6Title": "Ordenanza de Cambridge (hora 16)",
    "changes.t6Body": "En espera del corpus. Sin resultados hasta que se publique el documento fuente.",
    "changes.scope": "Alcance jurisdiccional",
    "changes.excluded": "Correctamente excluidas",
    "pipeline.eyebrow": "Proceso · Módulo A",
    "pipeline.title": "Del texto legal a normas citadas",
    "pipeline.lede":
      "La IA puede ayudar a estructurar la regulación. Sistemas deterministas evalúan la aplicabilidad. La evidencia sostiene la conclusión. Elija un documento del corpus y ejecute la extracción.",
    "pipeline.sourceDoc": "Documento fuente",
    "pipeline.run": "Ejecutar extracción",
    "pipeline.running": "Extrayendo…",
    "pipeline.empty": "Aún no hay extracción. Elija un documento y pulse Ejecutar extracción.",
    "pipeline.loadingDocs": "Cargando documentos del corpus…",
    "pipeline.docsError": "No se pudieron cargar los documentos del corpus.",
    "pipeline.docsCount": "documentos disponibles",
    "pipeline.liveCorpus": "Corpus en vivo",
    "pipeline.demoDocs": "Documentos de demostración",
    "pipeline.failed": "La extracción falló",
    "pipeline.stepSource": "1 · Texto fuente",
    "pipeline.stepValidation": "2 · Validación de esquema",
    "pipeline.stepRules": "3 · Normas estructuradas",
    "pipeline.via": "Extracción vía",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["en"];

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "en", setLocale: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = localStorage.getItem("cite-locale");
    if (saved === "es" || saved === "en") setLocaleState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("cite-locale", l);
  };
  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return useContext(Ctx);
}

export function useT() {
  const { locale } = useContext(Ctx);
  return (k: StringKey) => STRINGS[locale][k];
}
