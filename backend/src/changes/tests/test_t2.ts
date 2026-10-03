import type { ChangeResult } from "@rhl/shared";
import type { GeocodeResult } from "../../geocode/census.js";

/**
 * T2: Hoboken law → Hoboken only; Jersey City law → Jersey City only; Newark → neither.
 */
export function assertT2(
  result: ChangeResult | undefined,
  geos: Map<string, GeocodeResult>,
): string[] {
  const errors: string[] = [];
  if (!result) return ["T2 missing from changes"];

  const hoboken = [...geos.values()].filter((g) => g.legal_city === "Hoboken").length;
  const jerseyCity = [...geos.values()].filter(
    (g) => g.legal_city === "Jersey City",
  ).length;
  const expected = hoboken + jerseyCity;

  if (result.affected_address_ids.length !== expected) {
    errors.push(
      `T2 affected=${result.affected_address_ids.length}, expected ${expected} (Hoboken+Jersey City)`,
    );
  }

  for (const id of result.affected_address_ids) {
    const city = geos.get(id)?.legal_city;
    if (city === "Newark") {
      errors.push(`T2 incorrectly includes Newark address ${id}`);
    } else if (city !== "Hoboken" && city !== "Jersey City") {
      errors.push(`T2 unexpected city ${city} for ${id}`);
    }
  }

  if (/WARNING:\s*Newark incorrectly included/i.test(result.notes || "")) {
    errors.push("T2 notes report Newark leak");
  }
  if (!/Newark correctly excluded/i.test(result.notes || "")) {
    errors.push("T2 notes should confirm Newark excluded");
  }
  return errors;
}
