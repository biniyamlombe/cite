import {
  asCoverageObject,
  DEFAULT_AS_OF,
  type CoverageConditionsObject,
  type CoveragePredicate,
} from "@rhl/shared";
import {
  parseOptionalInt,
  type SampleAddress,
} from "../lib/addresses.js";
import type { GeocodeResult } from "../geocode/census.js";

type FactContext = {
  state: string;
  legal_city: string;
  year_built: number | null;
  units: number | null;
  owner_type: null; // never in sample pack
};

function ctxFrom(
  addr: SampleAddress,
  geo: GeocodeResult,
): FactContext {
  return {
    state: geo.state,
    legal_city: geo.legal_city,
    year_built: parseOptionalInt(addr.year_built),
    units: parseOptionalInt(addr.units),
    owner_type: null,
  };
}

function fieldValue(
  ctx: FactContext,
  field: CoveragePredicate["field"],
): string | number | null {
  switch (field) {
    case "state":
      return ctx.state;
    case "legal_city":
      return ctx.legal_city;
    case "year_built":
      return ctx.year_built;
    case "units":
      return ctx.units;
    case "owner_type":
      return ctx.owner_type;
  }
}

/** Returns whether the predicate matches the address facts. */
export function predicateMatches(
  pred: CoveragePredicate,
  addr: SampleAddress,
  geo: GeocodeResult,
  asOf: string = DEFAULT_AS_OF,
): boolean {
  const ctx = ctxFrom(addr, geo);
  const actual = fieldValue(ctx, pred.field);

  // Owner identity is never in the pack; only matters when unit count
  // does not already rule out small-landlord / owner-occupied exceptions.
  if (pred.field === "owner_type" && pred.operator === "missing") {
    if (ctx.units != null && ctx.units >= 5) return false;
    return true;
  }

  switch (pred.operator) {
    case "within_years":
      return typeof actual === "number" && typeof pred.value === "number" && actual > Number(asOf.slice(0, 4)) - pred.value;
    case "boundary_years":
      return typeof actual === "number" && typeof pred.value === "number" && actual === Number(asOf.slice(0, 4)) - pred.value;
    case "missing":
      return actual == null;
    case "present":
      return actual != null;
    case "eq":
      if (actual == null || pred.value == null) return false;
      if (typeof actual === "string") {
        return actual.toLowerCase() === String(pred.value).toLowerCase();
      }
      return actual === pred.value;
    case "neq":
      if (actual == null || pred.value == null) return false;
      if (typeof actual === "string") {
        return actual.toLowerCase() !== String(pred.value).toLowerCase();
      }
      return actual !== pred.value;
    case "lt":
      return (
        typeof actual === "number" &&
        typeof pred.value === "number" &&
        actual < pred.value
      );
    case "lte":
      return (
        typeof actual === "number" &&
        typeof pred.value === "number" &&
        actual <= pred.value
      );
    case "gt":
      return (
        typeof actual === "number" &&
        typeof pred.value === "number" &&
        actual > pred.value
      );
    case "gte":
      return (
        typeof actual === "number" &&
        typeof pred.value === "number" &&
        actual >= pred.value
      );
    default:
      return false;
  }
}

export type ExecutableHit =
  | { kind: "omit" }
  | { kind: "unknown"; reason: string }
  | { kind: "fail"; reason: string }
  | null;

/**
 * Evaluate dual coverage object. Jurisdiction `all` is informational when
 * the caller already filtered by jurisdiction; still enforced if present.
 */
export function evaluateExecutableCoverage(
  coverage: CoverageConditionsObject,
  addr: SampleAddress,
  geo: GeocodeResult,
  asOf: string = DEFAULT_AS_OF,
): ExecutableHit {
  for (const pred of coverage.omit_if || []) {
    if (predicateMatches(pred, addr, geo, asOf)) {
      return { kind: "omit" };
    }
  }
  for (const pred of coverage.unknown_if || []) {
    if (predicateMatches(pred, addr, geo, asOf)) {
      return {
        kind: "unknown",
        reason:
          pred.reason ||
          `Coverage depends on ${pred.field}, which is unresolved for this address.`,
      };
    }
  }
  for (const pred of coverage.all || []) {
    if (fieldValue(ctxFrom(addr, geo), pred.field) == null && pred.operator !== "missing") {
      return { kind: "unknown", reason: `Coverage depends on ${pred.field}, which is missing.` };
    }
    if (!predicateMatches(pred, addr, geo, asOf)) {
      return {
        kind: "fail",
        reason: `Address fails coverage predicate ${pred.field} ${pred.operator} ${pred.value ?? ""}`.trim(),
      };
    }
  }
  return null;
}

export function executableFromRule(rule: {
  coverage_conditions?: unknown;
}): CoverageConditionsObject | null {
  return asCoverageObject(
    rule.coverage_conditions as Parameters<typeof asCoverageObject>[0],
  );
}
