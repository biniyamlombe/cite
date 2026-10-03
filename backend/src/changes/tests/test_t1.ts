import type { ChangeResult } from "@rhl/shared";
import type { GeocodeResult } from "../../geocode/census.js";

/** T1: CA AB 325 / SB 763 flips not_yet_effective → applies across all CA addresses. */
export function assertT1(
  result: ChangeResult | undefined,
  geos: Map<string, GeocodeResult>,
): string[] {
  const errors: string[] = [];
  if (!result) return ["T1 missing from changes"];
  if (result.before_status !== "not_yet_effective") {
    errors.push(`T1 before_status=${result.before_status}, expected not_yet_effective`);
  }
  if (result.after_status !== "applies") {
    errors.push(`T1 after_status=${result.after_status}, expected applies`);
  }
  const caCount = [...geos.values()].filter((g) => g.state === "CA").length;
  if (result.affected_address_ids.length !== caCount) {
    errors.push(
      `T1 affected=${result.affected_address_ids.length}, expected all ${caCount} CA addresses`,
    );
  }
  if (!/date_flip_ok=/i.test(result.notes || "")) {
    errors.push("T1 notes should report date_flip_ok");
  }
  return errors;
}
