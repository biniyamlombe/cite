export type LookupResultValue = "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending";
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
  coverage_conditions?: string | { text?: string; all?: unknown; unknown_if?: unknown; omit_if?: unknown } | null;
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
  rule: Rule | null;
}

export interface LookupResponse {
  disclaimer: string;
  as_of: string;
  address: Omit<AddressRow, "legal_city" | "county">;
  jurisdiction: {
    state: string;
    county: string;
    city: string;
    resolution?: "census" | "known_jurisdiction" | "postal_fallback";
    trusted?: boolean;
  };
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
