import type { ChangeResult } from "@rhl/shared";
import type { GeocodeResult } from "../../geocode/census.js";

/** T4: MA algorithmic bills stay pending for MA addresses. */
export function assertT4(
  result: ChangeResult | undefined,
  geos: Map<string, GeocodeResult>,
): string[] {
  const errors: string[] = [];
  if (!result) return ["T4 missing from changes"];

  const maCount = [...geos.values()].filter((g) => g.state === "MA").length;
  if (result.affected_address_ids.length !== maCount) {
    errors.push(
      `T4 affected=${result.affected_address_ids.length}, expected ${maCount} MA addresses (pending)`,
    );
  }
  for (const id of result.affected_address_ids) {
    if (geos.get(id)?.state !== "MA") {
      errors.push(`T4 non-MA address ${id}`);
    }
  }
  return errors;
}
