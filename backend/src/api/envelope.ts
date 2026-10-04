import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import {
  API_SCHEMA_VERSION,
  PIPELINE_VERSION,
  type ApiErrorCode,
  type ApiWarning,
  type LookupProductState,
} from "@rhl/shared";

export function newRequestId(): string {
  return randomUUID();
}

export function buildMeta(opts: {
  requestId: string;
  asOf?: string;
  generatedAt?: string;
}) {
  return {
    request_id: opts.requestId,
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    ...(opts.asOf ? { as_of_date: opts.asOf } : {}),
    pipeline_version: PIPELINE_VERSION,
    schema_version: API_SCHEMA_VERSION,
  };
}

export function apiError(
  c: Context,
  status: 400 | 404 | 409 | 500,
  code: ApiErrorCode,
  message: string,
  userMessage: string,
  opts?: {
    retryable?: boolean;
    field_errors?: Record<string, string>;
    requestId?: string;
    extra?: Record<string, unknown>;
  },
) {
  const request_id = opts?.requestId ?? newRequestId();
  return c.json(
    {
      error: {
        code,
        message,
        user_message: userMessage,
        retryable: opts?.retryable ?? false,
        field_errors: opts?.field_errors ?? {},
        request_id,
      },
      ...(opts?.extra ?? {}),
    },
    status,
  );
}

type ResultLike = {
  result: string;
  conflict_flag?: boolean;
  needs_human_review?: boolean;
  facts_missing?: string[];
  rule?: { evidence_status?: string | null | undefined } | null | undefined;
};

export function deriveProductStates(input: {
  jurisdictionTrusted: boolean;
  jurisdictionStatus?: string;
  results: ResultLike[];
  corpusGaps: string[];
  userProvidedFacts: boolean;
}): LookupProductState[] {
  const states = new Set<LookupProductState>();
  const { results } = input;

  if (input.jurisdictionStatus === "ambiguous") states.add("address_ambiguous");
  else if (input.jurisdictionStatus === "failed") states.add("geocoding_failed");
  else if (input.jurisdictionTrusted) states.add("address_resolved");
  else states.add("partial_result");

  const missingFacts = results.some((r) => (r.facts_missing?.length ?? 0) > 0);
  if (missingFacts) states.add("building_facts_partial");

  if (results.length === 0) states.add("no_rules_found");
  else states.add("rules_found");

  const operative = results.filter(
    (r) => r.result === "applies" || r.result === "unknown",
  );
  const pendingLike = results.filter(
    (r) => r.result === "pending" || r.result === "not_yet_effective",
  );
  if (operative.length === 0 && pendingLike.length > 0) {
    states.add("pending_law_only");
  }

  if (
    results.some(
      (r) =>
        r.conflict_flag ||
        r.needs_human_review ||
        r.result === "unknown" && r.rule?.evidence_status === "scenario_only",
    )
  ) {
    states.add("requires_human_review");
  }

  if (
    results.some((r) => r.rule?.evidence_status === "scenario_only") ||
    input.corpusGaps.length > 0
  ) {
    states.add("source_unavailable");
  }

  if (input.corpusGaps.length > 0 || !input.jurisdictionTrusted) {
    states.add("partial_result");
  }

  return [...states];
}

export function deriveWarnings(input: {
  jurisdictionTrusted: boolean;
  jurisdictionResolution?: string;
  results: ResultLike[];
  corpusGaps: string[];
  userProvidedFacts: boolean;
}): ApiWarning[] {
  const warnings: ApiWarning[] = [];

  if (!input.jurisdictionTrusted || input.jurisdictionResolution === "postal_fallback") {
    warnings.push({
      code: "UNTRUSTED_GEOCODE",
      message: "Jurisdiction resolution is untrusted; city-level rules are blocked.",
      user_message:
        "We could not confidently determine the legal city. City rules are withheld until jurisdiction is trusted.",
    });
  }

  const missing = new Set(
    input.results.flatMap((r) => r.facts_missing ?? []).filter(Boolean),
  );
  if (missing.size) {
    warnings.push({
      code: "BUILDING_FACTS_MISSING",
      message: `Missing building facts: ${[...missing].join(", ")}`,
      user_message:
        "Some rules need more building information (for example year built or unit count) before coverage can be determined.",
    });
  }

  if (input.results.some((r) => r.conflict_flag || r.needs_human_review)) {
    warnings.push({
      code: "CONFLICT_REQUIRES_REVIEW",
      message: "One or more rules require human review due to conflict or ambiguity.",
      user_message:
        "Possible conflict or ambiguity: review the cited sources. This tool does not decide which rule prevails.",
    });
  }

  if (
    input.results.some(
      (r) => r.result === "pending" || r.result === "not_yet_effective",
    )
  ) {
    warnings.push({
      code: "PENDING_NOT_EFFECTIVE",
      message: "Pending or not-yet-effective measures are present.",
      user_message:
        "Some measures are pending or not yet in effect for the selected date and are not current enforceable law.",
    });
  }

  if (
    input.results.some((r) => r.rule?.evidence_status === "scenario_only") ||
    input.corpusGaps.length > 0
  ) {
    warnings.push({
      code: "SOURCE_UNAVAILABLE",
      message: "One or more primary ordinance sources are link-only or unavailable.",
      user_message:
        "Primary local source text is unavailable in this prototype. Quoted evidence stays on capturable corpus documents only.",
    });
  }

  if (input.corpusGaps.length > 0) {
    warnings.push({
      code: "CORPUS_GAP",
      message: `Corpus gaps: ${input.corpusGaps.join("; ")}`,
      user_message:
        "Local ordinance pages for this city are link-only or check-terms in the pack. Statewide rules may still appear.",
    });
  }

  if (input.userProvidedFacts) {
    warnings.push({
      code: "USER_PROVIDED_FACTS",
      message: "Lookup used session-scoped user-provided building facts.",
      user_message:
        "Results below use building facts you provided for this session. They are not verified public records.",
    });
  }

  return warnings;
}
