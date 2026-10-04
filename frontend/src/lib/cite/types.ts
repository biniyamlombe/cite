export type LookupResultValue =
  "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending" | "does_not_apply";
export type RuleStatus = "in_force" | "not_yet_effective" | "pending" | "failed";
export type Category =
  | "rent_increase_limits"
  | "just_cause_eviction"
  | "security_deposits"
  | "application_screening_fees"
  | "screening_restrictions"
  | "algorithmic_rent_setting";

export interface Health {
  ok: boolean;
  service: string;
  as_of_default: string;
  disclaimer: string;
  pipeline_version?: string | undefined;
  schema_version?: string | undefined;
}

export interface ApiWarning {
  code: string;
  message: string;
  user_message: string;
}

export interface ApiMeta {
  request_id: string;
  generated_at: string;
  as_of_date?: string;
  pipeline_version: string;
  schema_version: string;
}

export interface AddressRow {
  address_id: string;
  street_address: string;
  postal_city: string;
  state: string;
  zip: string;
  year_built: string;
  units: string;
  legal_city?: string | null;
  county?: string | null;
}

export interface Rule {
  stable_id?: string;
  alias_id?: string;
  evidence_status?: "captured" | "scenario_only";
  title: string;
  category: Category;
  citation: string;
  quoted_span: string;
  requirement: string;
  status: RuleStatus;
  level: "state" | "city";
  jurisdiction: string;
  source_url: string;
  source_doc_id?: string | null;
  retrieved_at?: string | null;
  confidence?: number | null;
  effective_date?: string | null;
  penalty?: string | null;
  coverage_conditions?:
    string | { text?: string; all?: unknown; unknown_if?: unknown; omit_if?: unknown } | null;
  exemptions?: string | null;
  conflict_note?: string | null;
  /** Backend-supplied explanation of which rule takes precedence when rules overlap. */
  precedence_note?: string | null;
}

export interface CatalogRule extends Rule {
  team_rule_id: string;
}

export interface LookupResult {
  team_rule_id: string;
  result: LookupResultValue;
  explanation: string;
  conflict_flag: boolean;
  /** Canonical audit applicability (optional enrichment from API). */
  applicability?: "applies" | "does_not_apply" | "unknown" | "needs_human_review";
  needs_human_review?: boolean;
  facts_used?: string[];
  facts_missing?: string[];
  legal_status_at_as_of_date?: RuleStatus;
  status_label?: string | null;
  applicability_label?: string | null;
  headline?: {
    text: string;
    why?: string;
    locale: "en-US" | "es-US";
    authoritative_language: "en";
  };
  plain_language_summary?: {
    text: string;
    translation_status:
      | "human_reviewed"
      | "machine_generated"
      | "source_official_translation"
      | "untranslated"
      | "not_applicable"
      | "not_available";
    authoritative_language: "en";
    source_text_en?: string;
    requires_human_review?: boolean;
    quality_flags?: string[];
  };
  source_evidence?: {
    official_quote_en: string;
    informational_translation_es: string | null;
    translation_notice: string;
    citation: string | null;
    url: string | null;
    retrieval_date: string | null;
  };
  translation?: {
    status: "human_reviewed" | "machine_generated" | "not_available" | "untranslated";
    requires_human_review: boolean;
  };
  rule: Rule | null;
}

export interface LookupResponse {
  disclaimer: string;
  as_of: string;
  locale?: "en-US" | "es-US";
  locale_warning?: string | null;
  address: Omit<AddressRow, "legal_city" | "county">;
  jurisdiction: {
    status?: "resolved" | "ambiguous" | "failed" | "unknown";
    state: string;
    county: string;
    city: string;
    state_fips?: string | null;
    county_fips?: string | null;
    place_geoid?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    source?: string;
    retrieved_at?: string | null;
    confidence?: number | null;
    resolution?: "census" | "known_jurisdiction" | "postal_fallback";
    trusted?: boolean;
  };
  building_facts?: {
    year_built: number | null;
    unit_count: number | null;
    property_type: string | null;
    occupancy_type: string | null;
    use_code: string | null;
    facts_source: string | null;
    override_fields?: string[];
  };
  audit?: {
    pipeline_version: string;
    generated_at: string;
    include_non_applicable?: boolean | undefined;
    request_id?: string | undefined;
    user_provided_facts?: boolean | undefined;
  };
  meta?: ApiMeta;
  warnings?: ApiWarning[];
  product_states?: string[];
  /** Pack link-only/check-terms city pages with no extracted city rules (e.g. Newark). */
  corpus_gaps?: string[];
  results: LookupResult[];
}

export type TestId = "T1" | "T2" | "T3" | "T4" | "T5";

export interface ChangeTest {
  test_id: TestId;
  title: string;
  type: string;
  expected_behavior: string;
  rule_ids: string[];
  as_of?: string;
  as_of_before?: string;
  as_of_after?: string;
}

export interface ChangeResult {
  affected_address_ids: string[];
  conflict_flag_address_ids?: string[];
  before_status?: string;
  after_status?: string;
  notes?: string;
}

export interface ChangesResponse {
  tests: ChangeTest[];
  results: Record<string, ChangeResult>;
}

export interface ExtractCheck {
  check: string;
  passed: boolean;
  detail: string;
}

/** GET /corpus/docs — capturable pack documents for Pipeline picker. */
export interface CorpusDocOption {
  doc_id: string;
  title: string;
  jurisdiction: string;
  source_url?: string;
  retrieved_at?: string;
  chars?: number;
}

/** POST /extract/doc/:docId — Module A live extract result. */
export interface ExtractResponse {
  doc_id: string;
  source_url: string;
  source_text: string;
  rules: CatalogRule[];
  validation: ExtractCheck[];
  source?: string | undefined;
}

export interface RuleVersion {
  version: string;
  corpus_release: string;
  released_at: string;
  status: RuleStatus;
  quoted_span: string;
  change_note: string;
}
