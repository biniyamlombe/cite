import type { ChangeResult } from "@rhl/shared";

/** T5: failed MA rent-control proposal → zero affected addresses. */
export function assertT5(result: ChangeResult | undefined): string[] {
  const errors: string[] = [];
  if (!result) return ["T5 missing from changes"];
  if (result.affected_address_ids.length !== 0) {
    errors.push(
      `T5 affected=${result.affected_address_ids.length}, expected 0 for failed ballot`,
    );
  }
  if (/WARNING:.*incorrectly show failed ballot/i.test(result.notes || "")) {
    errors.push("T5 notes report failed ballot incorrectly applying");
  }
  return errors;
}
