"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UI, type Locale, type UiMessages } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: UiMessages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const pathname = usePathname();

  useEffect(() => {
    const saved = window.localStorage.getItem("rhl-locale");
    if (saved === "en" || saved === "es") setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("rhl-locale", locale);
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
  }

  const t = UI[locale] as UiMessages;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      <div className="disclaimer">{t.disclaimer}</div>
      <div className="shell">
        <header className="nav">
          <Link href="/" className="brand">
            Rental Housing Law Navigator
            <span>{t.brandSub}</span>
          </Link>
          <div className="nav-right">
            <nav className="nav-links" aria-label="Primary">
              <Link
                href="/"
                className={pathname === "/" ? "active" : undefined}
              >
                {t.navLookup}
              </Link>
              <Link
                href="/changes"
                className={pathname === "/changes" ? "active" : undefined}
              >
                {t.navChanges}
              </Link>
              <Link
                href="/pipeline"
                className={pathname === "/pipeline" ? "active" : undefined}
              >
                {t.navPipeline}
              </Link>
            </nav>
            <div
              className="lang-toggle"
              role="group"
              aria-label="Language"
            >
              <button
                type="button"
                className={locale === "en" ? "active" : undefined}
                onClick={() => setLocale("en")}
              >
                {t.langEn}
              </button>
              <button
                type="button"
                className={locale === "es" ? "active" : undefined}
                onClick={() => setLocale("es")}
              >
                {t.langEs}
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    </LocaleContext.Provider>
  );
}
