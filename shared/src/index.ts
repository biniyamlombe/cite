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

export const RuleRecordSchema = z.object({
  team_rule_id: z.string().min(1),
  jurisdiction: z.string().min(1),
  level: RuleLevel,
  category: RuleCategory,
  status: RuleStatus,
  title: z.string().min(1),
  requirement: z.string().min(1),
  key_value: z.string().nullable().optional(),
  coverage_conditions: z
    .union([z.string(), z.record(z.unknown()), z.null()])
    .optional(),
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
