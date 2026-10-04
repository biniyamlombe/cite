import type { ChangeResult } from "@rhl/shared";
import type { GeocodeResult } from "../../geocode/census.js";

/** T3: NJ FAIR Act as-of flip + Hoboken/JC conflict flags. */
export function assertT3(
  result: ChangeResult | undefined,
  geos: Map<string, GeocodeResult>,
): string[] {
  const errors: string[] = [];
  if (!result) return ["T3 missing from changes"];

  const nj = [...geos.values()].filter((g) => g.state === "NJ");
  const conflictCities = nj.filter(
    (g) => g.legal_city === "Hoboken" || g.legal_city === "Jersey City",
  );

  if (result.before_status !== "not_yet_effective") {
    errors.push(`T3 before_status=${result.before_status}`);
  }
  if (result.after_status !== "applies") {
    errors.push(`T3 after_status=${result.after_status}`);
  }
  if (result.affected_address_ids.length !== nj.length) {
    errors.push(
      `T3 affected=${result.affected_address_ids.length}, expected ${nj.length} NJ addresses`,
    );
  }
  const conflicts = result.conflict_flag_address_ids?.length ?? 0;
  if (conflicts !== conflictCities.length) {
    errors.push(
      `T3 conflicts=${conflicts}, expected ${conflictCities.length} Hoboken+JC`,
    );
  }
  if (!/before_check=true/i.test(result.notes || "")) {
    errors.push("T3 before_check should be true");
  }
  if (!/after_check=true/i.test(result.notes || "")) {
    errors.push("T3 after_check should be true");
  }
  if (!new RegExp(`date_flip_ok=${nj.length}/${nj.length}`).test(result.notes || "")) {
    errors.push(`T3 notes should report date_flip_ok=${nj.length}/${nj.length}`);
  }
  if (!/Open question:.*FAIR/i.test(result.notes || "")) {
    errors.push("T3 notes should surface FAIR preemption open question");
  }
  if (!/conflict_flag_live=/i.test(result.notes || "")) {
    errors.push("T3 notes should report conflict_flag_live coverage");
  }
  return errors;
}
