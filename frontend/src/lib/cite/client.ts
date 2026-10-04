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
  corpusDocs(): Promise<CorpusDocOption[]>;
  extract(docId: string): Promise<ExtractResponse>;
  ruleVersions(teamRuleId: string): Promise<RuleVersion[]>;
}

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
