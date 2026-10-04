import { z } from "zod";

/** Full calendar date; rejecting rollover dates is essential for as-of evaluation. */
export const AsOfDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, "Expected a valid calendar date (YYYY-MM-DD)");

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
  /** API / enrichment only — omitted from pack submission lookups by default. */
  "does_not_apply",
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
    "within_years",
    "boundary_years",
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
  /** Penalty / remedy language when stated (civil fine, misdemeanor, treble damages, etc.). */
  penalty: z.string().nullable().optional(),
  citation: z.string().min(1),
  source_doc_id: z.string().nullable().optional(),
  source_url: z.string().min(1),
  /** Corpus retrieval timestamp for the source document (ISO or pack RETRIEVED line). */
  retrieved_at: z.string().nullable().optional(),
  quoted_span: z.string().min(20),
  /** Byte/char offsets of quoted_span within the source document body (when known). */
  quote_start_offset: z.number().int().nonnegative().nullable().optional(),
  quote_end_offset: z.number().int().nonnegative().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  conflict_flag: z.boolean().optional().default(false),
  conflict_note: z.string().nullable().optional(),
  /** Stable alias used by change tests (e.g. CA-ALG-01). */
  alias_id: z.string().optional(),
  /** Extraction method metadata (heuristic | claude | scaffold | …). */
  extraction_method: z.string().optional(),
  requires_human_review: z.boolean().optional(),
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

/** Canonical four-valued applicability (audit model). Pack `result` remains authoritative for submission. */
export const CanonicalApplicability = z.enum([
  "applies",
  "does_not_apply",
  "unknown",
  "needs_human_review",
]);
export type CanonicalApplicability = z.infer<typeof CanonicalApplicability>;

/**
 * Map pack lookup `result` + conflict into canonical applicability.
 * Pending / not-yet-effective / superseded are non-operative for current coverage.
 * Conflicts and scenario-only municipal bans require human review.
 */
export function toCanonicalApplicability(
  result: z.infer<typeof LookupResult>,
  conflictFlag = false,
): CanonicalApplicability {
  if (conflictFlag) return "needs_human_review";
  if (result === "applies") return "applies";
  if (result === "unknown") return "unknown";
  if (result === "does_not_apply") return "does_not_apply";
  // superseded | not_yet_effective | pending → not currently operative
  return "does_not_apply";
}

export const LookupEntrySchema = z.object({
  team_rule_id: z.string(),
  result: LookupResult,
  explanation: z.string(),
  conflict_flag: z.boolean().default(false),
  /** Audit enrichment — optional; ignored by organizer templates that only read core fields. */
  applicability: CanonicalApplicability.optional(),
  needs_human_review: z.boolean().optional(),
  facts_used: z.array(z.string()).optional(),
  facts_missing: z.array(z.string()).optional(),
  legal_status_at_as_of_date: RuleStatus.optional(),
  coverage_conditions_evaluated: z.array(z.string()).optional(),
  exemptions_evaluated: z.array(z.string()).optional(),
});

export type LookupEntry = z.infer<typeof LookupEntrySchema>;

export const ArtifactProvenanceSchema = z.object({
  schema_version: z.string(),
  pipeline_version: z.string(),
  generated_at: z.string(),
  as_of: AsOfDateSchema.optional(),
  pack_root: z.string().optional(),
  input_hashes: z.record(z.string()).optional(),
  notes: z.string().optional(),
});
export type ArtifactProvenance = z.infer<typeof ArtifactProvenanceSchema>;

export const LookupsFileSchema = z.object({
  as_of: AsOfDateSchema,
  lookups: z.record(z.array(LookupEntrySchema)),
});

export type LookupsFile = z.infer<typeof LookupsFileSchema>;

export const RulesFileSchema = z.object({
  rules: z.array(RuleRecordSchema),
});

export type RulesFile = z.infer<typeof RulesFileSchema>;

export const ChangeEvidenceSchema = z.object({
  address_id: z.string(),
  included: z.boolean(),
  reason: z.string(),
  rule_ids: z.array(z.string()).optional(),
});
export type ChangeEvidence = z.infer<typeof ChangeEvidenceSchema>;

export const ChangeResultSchema = z.object({
  affected_address_ids: z.array(z.string()),
  conflict_flag_address_ids: z.array(z.string()).optional(),
  notes: z.string().optional(),
  before_status: z.string().optional(),
  after_status: z.string().optional(),
  /** Compact inclusion/exclusion evidence (optional; graders ignore unknown keys). */
  evidence_summary: z.string().optional(),
  sample_evidence: z.array(ChangeEvidenceSchema).optional(),
});

export type ChangeResult = z.infer<typeof ChangeResultSchema>;

/** Organizer submission shape: bare T1–T5 map (no wrapper keys). */
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
export const PIPELINE_VERSION = "cite-1.1.0";
export const ARTIFACT_SCHEMA_VERSION = "1.1.0";
export const API_SCHEMA_VERSION = "1.3.0";

export * from "./locale.js";
export * from "./translation_safety.js";

/** UX product states returned with lookups (machine-readable). */
export const LookupProductState = z.enum([
  "address_resolved",
  "address_ambiguous",
  "address_out_of_scope",
  "geocoding_failed",
  "building_facts_partial",
  "rules_found",
  "no_rules_found",
  "source_unavailable",
  "pending_law_only",
  "requires_human_review",
  "partial_result",
  "processing_failed",
]);
export type LookupProductState = z.infer<typeof LookupProductState>;

export const ApiWarningCode = z.enum([
  "SOURCE_UNAVAILABLE",
  "JURISDICTION_LOW_CONFIDENCE",
  "BUILDING_FACTS_MISSING",
  "PENDING_NOT_EFFECTIVE",
  "CONFLICT_REQUIRES_REVIEW",
  "USER_PROVIDED_FACTS",
  "CORPUS_GAP",
  "UNTRUSTED_GEOCODE",
  "PARTIAL_RESULT",
]);
export type ApiWarningCode = z.infer<typeof ApiWarningCode>;

export const ApiWarningSchema = z.object({
  code: ApiWarningCode,
  message: z.string(),
  user_message: z.string(),
});
export type ApiWarning = z.infer<typeof ApiWarningSchema>;

export const ApiErrorCode = z.enum([
  "INVALID_AS_OF",
  "ADDRESS_NOT_FOUND",
  "ADDRESS_AMBIGUOUS",
  "ADDRESS_OUT_OF_SCOPE",
  "GEOCODING_FAILED",
  "NOT_GEOCODED",
  "NO_RULES_LOADED",
  "VALIDATION_ERROR",
  "EXTRACT_FAILED",
  "UNKNOWN_TEST",
  "UNKNOWN_RULE",
  "NOT_ALLOWED",
  "FILE_MISSING",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    user_message: z.string(),
    retryable: z.boolean(),
    field_errors: z.record(z.string()).default({}),
    request_id: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const ApiMetaSchema = z.object({
  request_id: z.string(),
  generated_at: z.string(),
  as_of_date: AsOfDateSchema.optional(),
  pipeline_version: z.string(),
  schema_version: z.string(),
});
export type ApiMeta = z.infer<typeof ApiMetaSchema>;

/** Safe session overrides for coverage preview (never persisted as corpus truth). */
export const BuildingFactOverridesSchema = z.object({
  year_built: z.union([z.string(), z.number()]).optional(),
  units: z.union([z.string(), z.number()]).optional(),
});
export type BuildingFactOverrides = z.infer<typeof BuildingFactOverridesSchema>;

/** Browser-safe response contracts. Keep API enrichment alongside core corpus records. */
export const ApiRuleSchema = RuleRecordSchema.extend({
  stable_id: z.string().optional(),
  evidence_status: z.enum(["captured", "scenario_only"]).optional(),
  precedence_note: z.string().nullable().optional(),
});
export const AddressSchema = z.object({
  address_id: z.string(), street_address: z.string(), postal_city: z.string(), state: z.string(), zip: z.string(), year_built: z.string(), units: z.string(),
  legal_city: z.string().nullable().optional(), county: z.string().nullable().optional(),
});
export const LookupResponseSchema = z.object({
  disclaimer: z.string(),
  as_of: AsOfDateSchema,
  locale: z.enum(["en-US", "es-US"]).optional(),
  locale_warning: z.string().nullable().optional(),
  address: AddressSchema,
  jurisdiction: z.object({
    status: z.enum(["resolved", "ambiguous", "failed", "unknown"]).optional(),
    state: z.string(),
    county: z.string(),
    city: z.string(),
    state_fips: z.string().nullable().optional(),
    county_fips: z.string().nullable().optional(),
    place_geoid: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    source: z.string().optional(),
    retrieved_at: z.string().nullable().optional(),
    confidence: z.number().nullable().optional(),
    resolution: z.enum(["census", "known_jurisdiction", "postal_fallback"]).optional(),
    trusted: z.boolean().optional(),
  }),
  building_facts: z
    .object({
      year_built: z.number().nullable(),
      unit_count: z.number().nullable(),
      property_type: z.string().nullable(),
      occupancy_type: z.string().nullable(),
      use_code: z.string().nullable(),
      facts_source: z.string().nullable(),
      override_fields: z.array(z.string()).optional(),
    })
    .optional(),
  audit: z
    .object({
      pipeline_version: z.string(),
      generated_at: z.string(),
      include_non_applicable: z.boolean().optional(),
      request_id: z.string().optional(),
      user_provided_facts: z.boolean().optional(),
    })
    .optional(),
  meta: ApiMetaSchema.optional(),
  warnings: z.array(ApiWarningSchema).optional(),
  product_states: z.array(LookupProductState).optional(),
  corpus_gaps: z.array(z.string()).optional(),
  results: z.array(
    LookupEntrySchema.extend({
      rule: ApiRuleSchema.nullable(),
      status_label: z.string().nullable().optional(),
      applicability_label: z.string().nullable().optional(),
      /** Language-neutral status/result codes remain on `result` / `applicability`. */
      plain_language_summary: z
        .object({
          text: z.string(),
          translation_status: z.enum([
            "human_reviewed",
            "machine_generated",
            "source_official_translation",
            "untranslated",
            "not_applicable",
            "not_available",
          ]),
          authoritative_language: z.literal("en"),
          source_text_en: z.string().optional(),
          requires_human_review: z.boolean().optional(),
          quality_flags: z.array(z.string()).optional(),
        })
        .optional(),
      source_evidence: z
        .object({
          official_quote_en: z.string(),
          informational_translation_es: z.string().nullable(),
          translation_notice: z.string(),
          citation: z.string().nullable(),
          url: z.string().nullable(),
          retrieval_date: z.string().nullable(),
        })
        .optional(),
      translation: z
        .object({
          status: z.enum([
            "human_reviewed",
            "machine_generated",
            "not_available",
            "untranslated",
          ]),
          requires_human_review: z.boolean(),
        })
        .optional(),
    }),
  ),
});
export const ChangesResponseSchema = z.object({
  tests: z.array(z.object({ test_id: z.enum(["T1", "T2", "T3", "T4", "T5"]), title: z.string(), type: z.string(), expected_behavior: z.string(), rule_ids: z.array(z.string()), as_of: z.string().optional(), as_of_before: z.string().optional(), as_of_after: z.string().optional() })),
  results: ChangesFileSchema,
  meta: ApiMetaSchema.optional(),
  warnings: z.array(ApiWarningSchema).optional(),
});
export const HealthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  as_of_default: AsOfDateSchema,
  disclaimer: z.string(),
  pipeline_version: z.string().optional(),
  schema_version: z.string().optional(),
});
export const VersionSchema = z.object({
  service: z.string(),
  pipeline_version: z.string(),
  schema_version: z.string(),
  api_schema_version: z.string(),
  as_of_default: AsOfDateSchema,
  disclaimer: z.string(),
});
export const CorpusDocSchema = z.object({ doc_id: z.string(), title: z.string(), jurisdiction: z.string(), source_url: z.string().optional(), retrieved_at: z.string().optional(), chars: z.number().optional() });
export const ExtractResponseSchema = z.object({ doc_id: z.string(), source_url: z.string(), source_text: z.string(), source: z.string().optional(), rules: z.array(ApiRuleSchema), validation: z.array(z.object({ check: z.string(), passed: z.boolean(), detail: z.string() })) });
export const RuleVersionSchema = z.object({ version: z.string(), corpus_release: z.string(), released_at: z.string(), status: RuleStatus, quoted_span: z.string(), change_note: z.string() });
