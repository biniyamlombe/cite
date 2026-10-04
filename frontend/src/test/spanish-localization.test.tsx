import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StatusBadge } from "@/components/cite/status";
import { LocaleProvider, useLocale, useT } from "@/lib/i18n";
import { CitationPanel } from "@/components/cite/rule";
import type { Rule } from "@/lib/cite/types";

function SwitcherProbe() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="lookup-label">{t("lookup.label")}</span>
      <button type="button" onClick={() => setLocale("es-US")}>
        {t("nav.lang.es")}
      </button>
      <button type="button" onClick={() => setLocale("en-US")}>
        {t("nav.lang.en")}
      </button>
    </div>
  );
}

const sampleRule: Rule = {
  title: "Sample Rule",
  category: "just_cause_eviction",
  citation: "California Civil Code § 1946.2(a)",
  quoted_span:
    "After a tenant has continuously and lawfully occupied a residential real property for 12 months, the owner of the residential real property shall not terminate the tenancy without just cause.",
  requirement: "Just cause required after 12 months.",
  status: "in_force",
  level: "state",
  jurisdiction: "California",
  source_url: "https://example.com/statute",
  retrieved_at: "2026-01-15",
};

function resetLocaleState(lang?: "en-US" | "es-US") {
  localStorage.clear();
  const url = new URL(window.location.href);
  if (lang) {
    url.searchParams.set("lang", lang);
    localStorage.setItem("cite-locale", lang);
  } else {
    url.searchParams.delete("lang");
  }
  window.history.replaceState(null, "", url.toString());
}

describe("Spanish localization UX", () => {
  beforeEach(() => {
    resetLocaleState();
  });

  it("switches UI chrome to Spanish and back without losing keys", async () => {
    render(
      <LocaleProvider>
        <SwitcherProbe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en-US"));
    fireEvent.click(screen.getByRole("button", { name: /Español/i }));
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("es-US"));
    expect(screen.getByTestId("lookup-label").textContent).toMatch(/dirección/i);
    fireEvent.click(screen.getByRole("button", { name: /English/i }));
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en-US"));
    expect(screen.getByTestId("lookup-label").textContent).toMatch(/address/i);
  });

  it("labels unknown distinctly in Spanish badges", async () => {
    resetLocaleState("es-US");
    render(
      <LocaleProvider>
        <StatusBadge value="unknown" kind="applicability" />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/No se puede determinar/i)).toBeTruthy();
    expect(screen.queryByText(/^No$/i)).toBeNull();
  });

  it("marks English source quotes as authoritative", async () => {
    resetLocaleState("es-US");
    render(
      <LocaleProvider>
        <CitationPanel rule={sampleRule} asOf="2026-10-01" />
      </LocaleProvider>,
    );
    expect(await screen.findByText(/Texto legal original en inglés/i)).toBeTruthy();
    expect(screen.getByText(/fuente legal oficial/i)).toBeTruthy();
    expect(screen.getByText(/California Civil Code § 1946.2\(a\)/)).toBeTruthy();
    const quote = document.querySelector("blockquote");
    expect(quote?.getAttribute("lang")).toBe("en");
    expect(quote?.textContent).toContain("just cause");
  });
});
