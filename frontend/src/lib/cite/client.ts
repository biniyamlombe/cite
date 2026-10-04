import type {
  RuleVersion,
  AddressRow,
  CatalogRule,
  ChangesResponse,
  CorpusDocOption,
  ExtractResponse,
  Health,
  LookupResponse,
} from "./types";
import { z } from "zod";
import {
  AddressSchema,
  ApiRuleSchema,
  AsOfDateSchema,
  ChangesResponseSchema,
  CorpusDocSchema,
  ExtractResponseSchema,
  HealthSchema,
  LookupResponseSchema,
  RuleVersionSchema,
} from "@rhl/shared";
import { parseCiteApiError } from "./api-error";
const fixtures = () => import("@/mocks/cite");

export const DEFAULT_AS_OF = "2026-10-01";
export const DISCLAIMER =
  "Not legal advice and not a compliance certification. Based on available public records in this prototype. Verify important decisions with a qualified legal professional.";

export type LookupOptions = {
  includeNonApplicable?: boolean | undefined;
  yearBuilt?: string | number | undefined;
  units?: string | number | undefined;
  locale?: "en-US" | "es-US" | undefined;
  signal?: AbortSignal | undefined;
};

export interface CiteApiClient {
  readonly mode: "live" | "mock";
  health(): Promise<Health>;
  addresses(q: string, limit?: number, signal?: AbortSignal): Promise<AddressRow[]>;
  lookup(addressId: string, asOf: string, options?: LookupOptions): Promise<LookupResponse>;
  changes(): Promise<ChangesResponse>;
  rules(): Promise<CatalogRule[]>;
  noRuleFindings(): Promise<import("./types").NoRuleFindingsResponse>;
  checkRent(input: {
    address_id: string;
    as_of?: string;
    current_rent: number;
    new_rent: number;
  }): Promise<import("./types").RentCheckResponse>;
  ask(input: {
    address_id: string;
    as_of?: string;
    question: string;
    locale?: "en-US" | "es-US";
  }): Promise<AskResponse>;
  letter(input: {
    address_id: string;
    as_of?: string;
    current_rent: number;
    new_rent: number;
    locale?: "en-US" | "es-US";
  }): Promise<LetterResponse>;
  tts(input: {
    address_id: string;
    as_of?: string;
    locale?: "en-US" | "es-US";
    persona?: "renter" | "owner";
  }): Promise<TtsResponse>;
  corpusDocs(): Promise<CorpusDocOption[]>;
  extract(docId: string): Promise<ExtractResponse>;
  ruleVersions(teamRuleId: string): Promise<RuleVersion[]>;
}

export type AskResponse = {
  disclaimer: string;
  as_of: string;
  locale: string;
  address_id: string;
  question: string;
  answer: string;
  refused: boolean;
  refusal_reason: string | null;
  citations: Array<{
    team_rule_id: string;
    citation: string;
    quoted_span: string;
    result: string;
    source_url?: string;
  }>;
};

export type LetterResponse = {
  disclaimer: string;
  as_of: string;
  address_id: string;
  text: string;
  verdict_kind: string;
};

export type TtsResponse =
  | { fallback: true; text: string; reason?: string }
  | { fallback: false; blob: Blob };

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function withOverrides(data: LookupResponse, options?: LookupOptions): LookupResponse {
  if (!options?.yearBuilt && !options?.units) return data;
  const year = options.yearBuilt != null ? String(options.yearBuilt) : data.address.year_built;
  const units = options.units != null ? String(options.units) : data.address.units;
  return {
    ...data,
    address: { ...data.address, year_built: year, units },
    building_facts: {
      year_built: year ? Number(year) || null : null,
      unit_count: units ? Number(units) || null : null,
      property_type: data.building_facts?.property_type ?? null,
      occupancy_type: data.building_facts?.occupancy_type ?? null,
      use_code: data.building_facts?.use_code ?? null,
      facts_source: "user_provided",
      override_fields: [
        ...(options.yearBuilt != null ? ["year_built"] : []),
        ...(options.units != null ? ["units"] : []),
      ],
    },
    audit: {
      pipeline_version: data.audit?.pipeline_version ?? "cite-mock",
      generated_at: data.audit?.generated_at ?? new Date().toISOString(),
      user_provided_facts: true,
      ...(options.includeNonApplicable != null
        ? { include_non_applicable: options.includeNonApplicable }
        : {}),
    },
    warnings: [
      ...(data.warnings ?? []),
      {
        code: "USER_PROVIDED_FACTS",
        message: "Mock lookup annotated with user-provided facts (offline preview).",
        user_message:
          "Results use building facts you provided for this session. Offline demo cannot fully re-evaluate coverage.",
      },
    ],
  };
}

export class MockCiteApiClient implements CiteApiClient {
  readonly mode = "mock" as const;
  async health(): Promise<Health> {
    return {
      ok: true,
      service: "cite-api",
      as_of_default: DEFAULT_AS_OF,
      disclaimer: DISCLAIMER,
      pipeline_version: "cite-mock",
      schema_version: "1.2.0",
    };
  }
  async addresses(q: string, limit = 8) {
    await delay(120);
    const { MOCK_ADDRESSES } = await fixtures();
    const s = q.trim().toLowerCase();
    const rows = s
      ? MOCK_ADDRESSES.filter((a) =>
          [a.address_id, a.street_address, a.postal_city, a.legal_city ?? "", a.zip].some((v) =>
            v.toLowerCase().includes(s),
          ),
        )
      : MOCK_ADDRESSES;
    return rows.slice(0, limit);
  }
  async lookup(addressId: string, asOf: string, options?: LookupOptions) {
    await delay();
    const { mockLookup } = await fixtures();
    const r = mockLookup(addressId, asOf);
    if (!r) throw new Error(`Address ${addressId} not found`);
    const annotated: LookupResponse = {
      ...r,
      audit: {
        pipeline_version: r.audit?.pipeline_version ?? "cite-mock",
        generated_at: r.audit?.generated_at ?? new Date().toISOString(),
        ...(options?.includeNonApplicable != null
          ? { include_non_applicable: Boolean(options.includeNonApplicable) }
          : {}),
      },
    };
    return withOverrides(annotated, options);
  }
  async changes() {
    await delay();
    return (await fixtures()).MOCK_CHANGES;
  }
  async rules() {
    await delay();
    return (await fixtures()).MOCK_RULES;
  }
  async noRuleFindings() {
    await delay();
    return {
      disclaimer: DISCLAIMER,
      count: 0,
      findings: [],
      generated_at: null,
    };
  }
  async checkRent(input: {
    address_id: string;
    as_of?: string;
    current_rent: number;
    new_rent: number;
  }) {
    await delay();
    const lookup = await this.lookup(input.address_id, input.as_of ?? DEFAULT_AS_OF);
    const cur = input.current_rent;
    const neu = input.new_rent;
    const increase = Number((((neu - cur) / cur) * 100).toFixed(2));
    const applying = lookup.results.filter(
      (r) => r.result === "applies" && r.rule?.category === "rent_increase_limits",
    );
    const kv = applying.map((r) => r.rule?.key_value).join(" ");
    const pctM = kv.match(/(\d+(?:\.\d+)?)\s*%/);
    const cap = pctM ? Number(pctM[1]) : null;
    const values: import("./types").RentCheckVerdict["values"] = {
      current_rent: cur,
      new_rent: neu,
      increase_pct: increase,
    };
    let kind: import("./types").RentCheckVerdict["kind"] = "none";
    let code = "no_applying_cap";
    let need: { key: string } | undefined;
    if (applying.length && cap != null) {
      values.cap_pct = cap;
      values.max_rent = Number((cur * (1 + cap / 100)).toFixed(2));
      if (neu <= (values.max_rent ?? 0) + 0.005) {
        kind = "ok";
        code = "within";
      } else {
        kind = "over";
        code = "over";
        values.over_amount = Number((neu - (values.max_rent ?? 0)).toFixed(2));
      }
    } else if (applying.length) {
      kind = "unknown";
      code = "need_figure";
      need = { key: "rate_figure" };
    }
    return {
      disclaimer: DISCLAIMER,
      as_of: input.as_of ?? DEFAULT_AS_OF,
      address_id: input.address_id,
      verdict: {
        kind,
        code,
        values,
        need,
        deciding_rule_ids: applying.map((r) => r.team_rule_id),
        deciding_quotes: applying
          .filter((r) => r.rule)
          .map((r) => ({
            team_rule_id: r.team_rule_id,
            citation: r.rule!.citation,
            quoted_span: r.rule!.quoted_span,
            source_url: r.rule!.source_url,
          })),
      },
    };
  }
  async ask(input: {
    address_id: string;
    as_of?: string;
    question: string;
    locale?: "en-US" | "es-US";
  }): Promise<AskResponse> {
    await delay();
    const lookup = await this.lookup(input.address_id, input.as_of ?? DEFAULT_AS_OF);
    const q = input.question.toLowerCase();
    if (/\b(get around|evade|bypass|loophole)\b/.test(q)) {
      return {
        disclaimer: DISCLAIMER,
        as_of: input.as_of ?? DEFAULT_AS_OF,
        locale: input.locale ?? "en-US",
        address_id: input.address_id,
        question: input.question,
        answer:
          "I can only summarize applying rules from retrieved sources — not help evade them.",
        refused: true,
        refusal_reason: "evasion",
        citations: [],
      };
    }
    const rent = lookup.results.filter(
      (r) => r.result === "applies" && r.rule?.category === "rent_increase_limits",
    );
    const cites = (rent.length ? rent : lookup.results.filter((r) => r.result === "applies")).slice(
      0,
      3,
    );
    const lines = cites.map(
      (r) => r.headline?.text ?? r.rule?.citation ?? r.team_rule_id,
    );
    return {
      disclaimer: DISCLAIMER,
      as_of: input.as_of ?? DEFAULT_AS_OF,
      locale: input.locale ?? "en-US",
      address_id: input.address_id,
      question: input.question,
      answer: lines.length
        ? `Based on retrieved applying rules:\n\n${lines.map((l) => `• ${l}`).join("\n")}`
        : "No applying rules were retrieved for this address.",
      refused: false,
      refusal_reason: null,
      citations: cites
        .filter((r) => r.rule)
        .map((r) => ({
          team_rule_id: r.team_rule_id,
          citation: r.rule!.citation,
          quoted_span: r.rule!.quoted_span,
          result: r.result,
          source_url: r.rule!.source_url,
        })),
    };
  }
  async letter(input: {
    address_id: string;
    as_of?: string;
    current_rent: number;
    new_rent: number;
    locale?: "en-US" | "es-US";
  }): Promise<LetterResponse> {
    await delay();
    const check = await this.checkRent(input);
    const quote = check.verdict.deciding_quotes[0];
    const text = [
      "Dear Landlord,",
      "",
      `I am writing about a proposed rent change from $${input.current_rent} to $${input.new_rent} (${check.verdict.values.increase_pct}% increase) as of ${check.as_of}.`,
      check.verdict.values.cap_pct != null
        ? `Retrieved rules state a cap of about ${check.verdict.values.cap_pct}%.`
        : "No numeric rent cap was retrieved for this address.",
      quote ? `Citation: ${quote.citation}. Quote: “${quote.quoted_span}”` : "",
      "",
      "This is not legal advice. Please verify with a qualified professional.",
      "",
      "Sincerely,",
      "Tenant",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      disclaimer: DISCLAIMER,
      as_of: check.as_of,
      address_id: input.address_id,
      text,
      verdict_kind: check.verdict.kind,
    };
  }
  async tts(input: {
    address_id: string;
    as_of?: string;
    locale?: "en-US" | "es-US";
    persona?: "renter" | "owner";
  }): Promise<TtsResponse> {
    await delay(80);
    const ask = await this.ask({
      address_id: input.address_id,
      as_of: input.as_of,
      question: "Summarize applying rent rules",
      locale: input.locale,
    });
    return { fallback: true, text: ask.answer, reason: "mock" };
  }
  async corpusDocs() {
    await delay(80);
    return (await fixtures()).MOCK_EXTRACT_DOCS;
  }
  async extract(docId: string) {
    await delay(900);
    const { mockExtract } = await fixtures();
    const r = mockExtract(docId);
    if (!r) throw new Error(`Document ${docId} not found in corpus`);
    return r;
  }
  async ruleVersions(teamRuleId: string) {
    await delay();
    return (await fixtures()).mockRuleVersions(teamRuleId);
  }
}

export class HttpCiteApiClient implements CiteApiClient {
  readonly mode = "live" as const;
  constructor(private base: string) {}
  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const method = init?.method ?? "GET";
    const signal = init?.signal ?? AbortSignal.timeout(method === "POST" ? 180000 : 15000);
    const res = await fetch(`${this.base.replace(/\/$/, "")}${path}`, {
      ...init,
      method,
      signal,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw parseCiteApiError(res.status, raw);
    return raw;
  }
  async health(): Promise<Health> {
    return HealthSchema.parse(await this.request("/health")) as Health;
  }
  async addresses(q: string, limit = 8, signal?: AbortSignal): Promise<AddressRow[]> {
    const init: RequestInit = signal ? { signal } : {};
    const raw = await this.request(`/addresses?q=${encodeURIComponent(q)}&limit=${limit}`, init);
    return z.object({ addresses: z.array(AddressSchema) }).parse(raw).addresses as AddressRow[];
  }
  async lookup(addressId: string, asOf: string, options?: LookupOptions): Promise<LookupResponse> {
    AsOfDateSchema.parse(asOf);
    const params = new URLSearchParams({ as_of: asOf });
    if (options?.includeNonApplicable) params.set("include_non_applicable", "1");
    if (options?.yearBuilt != null) params.set("year_built", String(options.yearBuilt));
    if (options?.units != null) params.set("units", String(options.units));
    if (options?.locale) params.set("locale", options.locale);
    const init: RequestInit = options?.signal ? { signal: options.signal } : {};
    return LookupResponseSchema.parse(
      await this.request(`/lookup/${encodeURIComponent(addressId)}?${params}`, init),
    ) as LookupResponse;
  }
  async changes(): Promise<ChangesResponse> {
    return ChangesResponseSchema.parse(await this.request("/changes")) as ChangesResponse;
  }
  async rules(): Promise<CatalogRule[]> {
    return z.object({ rules: z.array(ApiRuleSchema) }).parse(await this.request("/rules"))
      .rules as CatalogRule[];
  }
  async noRuleFindings() {
    return (await this.request("/no-rule-findings")) as import("./types").NoRuleFindingsResponse;
  }
  async checkRent(input: {
    address_id: string;
    as_of?: string;
    current_rent: number;
    new_rent: number;
  }) {
    return (await this.request("/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })) as import("./types").RentCheckResponse;
  }
  async ask(input: {
    address_id: string;
    as_of?: string;
    question: string;
    locale?: "en-US" | "es-US";
  }): Promise<AskResponse> {
    return (await this.request("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })) as AskResponse;
  }
  async letter(input: {
    address_id: string;
    as_of?: string;
    current_rent: number;
    new_rent: number;
    locale?: "en-US" | "es-US";
  }): Promise<LetterResponse> {
    return (await this.request("/letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })) as LetterResponse;
  }
  async tts(input: {
    address_id: string;
    as_of?: string;
    locale?: "en-US" | "es-US";
    persona?: "renter" | "owner";
  }): Promise<TtsResponse> {
    const res = await fetch(`${this.base.replace(/\/$/, "")}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(180000),
    });
    const ctype = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      const raw = await res.json().catch(() => ({}));
      throw parseCiteApiError(res.status, raw);
    }
    if (ctype.includes("audio/")) {
      return { fallback: false, blob: await res.blob() };
    }
    const raw = (await res.json()) as { text?: string; reason?: string; fallback?: boolean };
    return { fallback: true, text: raw.text ?? "", reason: raw.reason };
  }
  async corpusDocs(): Promise<CorpusDocOption[]> {
    return z.object({ docs: z.array(CorpusDocSchema) }).parse(await this.request("/corpus/docs"))
      .docs as CorpusDocOption[];
  }
  async extract(docId: string): Promise<ExtractResponse> {
    return ExtractResponseSchema.parse(
      await this.request(`/extract/doc/${encodeURIComponent(docId)}`, { method: "POST" }),
    ) as ExtractResponse;
  }
  async ruleVersions(teamRuleId: string): Promise<RuleVersion[]> {
    return z
      .object({ versions: z.array(RuleVersionSchema) })
      .parse(await this.request(`/rules/${encodeURIComponent(teamRuleId)}/versions`)).versions;
  }
}

let client: CiteApiClient | null = null;
export function getCiteClient(): CiteApiClient {
  if (!client) {
    const url = import.meta.env["VITE_API_URL"] as string | undefined;
    client = url ? new HttpCiteApiClient(url) : new MockCiteApiClient();
  }
  return client;
}
