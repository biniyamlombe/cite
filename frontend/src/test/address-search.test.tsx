import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/lib/i18n";
import { AddressSearch } from "@/routes/index";
const search = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cite/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cite/client")>()),
  getCiteClient: () => ({ addresses: search }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});
const address = {
  address_id: "A0005",
  street_address: "1609 Addison St",
  postal_city: "Berkeley",
  state: "CA",
  zip: "94703",
  year_built: "",
  units: "",
};
function mount() {
  const pick = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LocaleProvider>
        <AddressSearch onSelect={pick} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return pick;
}
describe("keyboard search", () => {
  it("announces and selects options, supports Escape and reopening", async () => {
    search.mockResolvedValue([address]);
    const pick = mount();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "A0005" } });
    await screen.findByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("option").id);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(pick).toHaveBeenCalledWith(address);
  });
  it("distinguishes failed search from no matches and retries", async () => {
    search.mockRejectedValue(new Error("offline"));
    mount();
    fireEvent.focus(screen.getByRole("combobox"));
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    search.mockResolvedValue([address]);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("option")).toHaveTextContent("1609 Addison");
  });

  it("shows a clear control that empties the query", async () => {
    search.mockResolvedValue([address]);
    mount();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Delongpre" } });
    expect(input).toHaveValue("Delongpre");
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();
  });
});
