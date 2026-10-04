/** Santa Ana stretch addresses live outside the pack's graded 500. */
export function isStretchAddress(addressId: string | null | undefined): boolean {
  return Boolean(addressId?.toUpperCase().startsWith("SA"));
}

export type StretchDemoTip = "applies" | "exempt" | "generic";

/** Demo tip for the SA0001 (pre-2012) vs SA0003 (2018 / 15-year just-cause) contrast. */
export function stretchDemoTip(addressId: string | null | undefined): StretchDemoTip {
  const id = addressId?.toUpperCase() ?? "";
  if (id === "SA0001") return "applies";
  if (id === "SA0003") return "exempt";
  if (isStretchAddress(id)) return "generic";
  return "generic";
}
