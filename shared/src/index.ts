import { z } from "zod";

export const RuleLevel = z.enum(["state", "city"]);
export const RuleCategory = z.enum([
  "rent_increase_limits",
  "just_cause_eviction",
  "security_deposits",
  "application_screening_fees",
  "screening_restrictions",
  "algorithmic_rent_setting",
]);
export const RuleStatus = z.enum([
  "in_force",
  "not_yet_effective",
  "pending",
  "failed",
]);
export const LookupResult = z.enum([
  "applies",
  "unknown",
  "superseded",
  "not_yet_effective",
  "pending",
]);

/** Machine-executable coverage predicate (internal DSL). */
export const CoveragePredicateSchema = z.object({
  field: z.enum(["state", "legal_city", "year_built", "units", "owner_type"]),
  operator: z.enum([
    "eq",
    "neq",
    "lt",
    "lte",
    "gt",
    "gte",
    "missing",
    "present",
  ]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  reason: z.string().optional(),
});

/**
 * Dual coverage form: plain-language `text` + executable predicates.
 * Fits organizer schema `coverage_conditions: string | object | null`.
 */
export const CoverageConditionsObjectSchema = z.object({
  text: z.string(),
  all: z.array(CoveragePredicateSchema).default([]),
  unknown_if: z.array(CoveragePredicateSchema).optional(),
  omit_if: z.array(CoveragePredicateSchema).optional(),
});

export const CoverageConditionsSchema = z.union([
  z.string(),
  CoverageConditionsObjectSchema,
  z.null(),
]);

export const RuleRecordSchema = z.object({
  team_rule_id: z.string().min(1),
  jurisdiction: z.string().min(1),
  level: RuleLevel,
  category: RuleCategory,
  status: RuleStatus,
  title: z.string().min(1),
  requirement: z.string().min(1),
  key_value: z.string().nullable().optional(),
  coverage_conditions: CoverageConditionsSchema.optional(),
  exemptions: z.string().nullable().optional(),
  overrides: z.array(z.string()).optional(),
  interaction: z.string().nullable().optional(),
  effective_date: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .nullable()
    .optional(),
  citation: z.string().min(1),
  source_doc_id: z.string().nullable().optional(),
  source_url: z.string().min(1),
  quoted_span: z.string().min(20),
  confidence: z.number().min(0).max(1).nullable().optional(),
  conflict_flag: z.boolean().optional().default(false),
  conflict_note: z.string().nullable().optional(),
  /** Stable alias used by change tests (e.g. CA-ALG-01). */
  alias_id: z.string().optional(),
});

export type RuleRecord = z.infer<typeof RuleRecordSchema>;
export type RuleLevel = z.infer<typeof RuleLevel>;
export type RuleCategory = z.infer<typeof RuleCategory>;
export type RuleStatus = z.infer<typeof RuleStatus>;
export type LookupResult = z.infer<typeof LookupResult>;
export type CoveragePredicate = z.infer<typeof CoveragePredicateSchema>;
export type CoverageConditionsObject = z.infer<
  typeof CoverageConditionsObjectSchema
>;

/** Plain-language coverage text whether stored as string or dual object. */
export function coveragePlainText(
  coverage: RuleRecord["coverage_conditions"],
): string {
  if (coverage == null) return "";
  if (typeof coverage === "string") return coverage;
  if (typeof coverage === "object" && "text" in coverage && coverage.text) {
    return coverage.text;
  }
  return "";
}

export function asCoverageObject(
  coverage: RuleRecord["coverage_conditions"],
): CoverageConditionsObject | null {
  if (!coverage || typeof coverage === "string") return null;
  const parsed = CoverageConditionsObjectSchema.safeParse(coverage);
  return parsed.success ? parsed.data : null;
}

export const LookupEntrySchema = z.object({
  team_rule_id: z.string(),
  result: LookupResult,
  explanation: z.string(),
  conflict_flag: z.boolean().default(false),
});

export type LookupEntry = z.infer<typeof LookupEntrySchema>;

export const LookupsFileSchema = z.object({
  as_of: z.string(),
  lookups: z.record(z.array(LookupEntrySchema)),
});

export type LookupsFile = z.infer<typeof LookupsFileSchema>;

export const RulesFileSchema = z.object({
  rules: z.array(RuleRecordSchema),
});

export type RulesFile = z.infer<typeof RulesFileSchema>;

export const ChangeResultSchema = z.object({
  affected_address_ids: z.array(z.string()),
  conflict_flag_address_ids: z.array(z.string()).optional(),
  notes: z.string().optional(),
  before_status: z.string().optional(),
  after_status: z.string().optional(),
});

export type ChangeResult = z.infer<typeof ChangeResultSchema>;

export const ChangesFileSchema = z.record(ChangeResultSchema);
export type ChangesFile = z.infer<typeof ChangesFileSchema>;

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  rent_increase_limits: "Rent increase limits",
  just_cause_eviction: "Just cause eviction",
  security_deposits: "Security deposits",
  application_screening_fees: "Application screening fees",
  screening_restrictions: "Screening restrictions",
  algorithmic_rent_setting: "Algorithmic rent setting",
};

export const DEFAULT_AS_OF = "2026-10-01";
