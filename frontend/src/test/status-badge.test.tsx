import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/cite/status";
import { LocaleProvider } from "@/lib/i18n";

describe("StatusBadge", () => {
  it("includes icon and screen-reader help, not color alone", () => {
    render(
      <LocaleProvider>
        <StatusBadge value="applies" kind="applicability" />
      </LocaleProvider>,
    );
    expect(screen.getByText(/Coverage:/i)).toBeTruthy();
    expect(document.querySelector("svg")).toBeTruthy();
    expect(document.querySelector(".sr-only")).toBeTruthy();
  });

  it("labels pending distinctly", () => {
    render(
      <LocaleProvider>
        <StatusBadge value="pending" kind="legal_status" />
      </LocaleProvider>,
    );
    expect(screen.getByText(/Legal status:/i)).toBeTruthy();
    expect(screen.getByTitle(/Pending legislation/i)).toBeTruthy();
  });
});
