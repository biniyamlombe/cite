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
    "action.print": "Print memo",
    "action.share": "Copy link",
    "action.copied": "Copied",
    "action.copyCitation": "Copy citation",
    "memo.title": "Regulatory applicability memo",
    "memo.generated": "Generated",
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
    "action.print": "Imprimir memo",
    "action.share": "Copiar enlace",
    "action.copied": "Copiado",
    "action.copyCitation": "Copiar cita",
    "memo.title": "Memorándum de aplicabilidad regulatoria",
    "memo.generated": "Generado",
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
