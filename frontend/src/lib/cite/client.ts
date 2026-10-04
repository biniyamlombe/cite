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
import { AddressSchema, ApiRuleSchema, AsOfDateSchema, ChangesResponseSchema, CorpusDocSchema, ExtractResponseSchema, HealthSchema, LookupResponseSchema, RuleVersionSchema } from "@rhl/shared";
const fixtures = () => import("@/mocks/cite");

export const DEFAULT_AS_OF = "2026-10-01";
export const DISCLAIMER =
  "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.";

export interface CiteApiClient {
  readonly mode: "live" | "mock";
  health(): Promise<Health>;
  addresses(q: string, limit?: number): Promise<AddressRow[]>;
  lookup(addressId: string, asOf: string): Promise<LookupResponse>;
  changes(): Promise<ChangesResponse>;
  rules(): Promise<CatalogRule[]>;
  corpusDocs(): Promise<CorpusDocOption[]>;
  extract(docId: string): Promise<ExtractResponse>;
  ruleVersions(teamRuleId: string): Promise<RuleVersion[]>;
}

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

export class MockCiteApiClient implements CiteApiClient {
  readonly mode = "mock" as const;
  async health(): Promise<Health> {
    return { ok: true, service: "cite-api", as_of_default: DEFAULT_AS_OF, disclaimer: "Not legal advice" };
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
  async lookup(addressId: string, asOf: string) {
    await delay();
    const { mockLookup } = await fixtures();
    const r = mockLookup(addressId, asOf);
    if (!r) throw new Error(`Address ${addressId} not found`);
    return r;
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
  private async request(path: string, method = "GET"): Promise<unknown> {
    const res = await fetch(`${this.base.replace(/\/$/, "")}${path}`, { method, signal: AbortSignal.timeout(method === "POST" ? 180000 : 15000) });
    if (!res.ok) throw new Error(`Cite API ${res.status} on ${path}`);
    return res.json();
  }
  async health() { return HealthSchema.parse(await this.request("/health")); }
  async addresses(q: string, limit = 8): Promise<AddressRow[]> {
    const raw = await this.request(`/addresses?q=${encodeURIComponent(q)}&limit=${limit}`);
    return z.object({ addresses: z.array(AddressSchema) }).parse(raw).addresses as AddressRow[];
  }
  async lookup(addressId: string, asOf: string): Promise<LookupResponse> {
    AsOfDateSchema.parse(asOf);
    return LookupResponseSchema.parse(await this.request(`/lookup/${encodeURIComponent(addressId)}?as_of=${encodeURIComponent(asOf)}`)) as LookupResponse;
  }
  async changes(): Promise<ChangesResponse> { return ChangesResponseSchema.parse(await this.request("/changes")) as ChangesResponse; }
  async rules(): Promise<CatalogRule[]> { return z.object({ rules: z.array(ApiRuleSchema) }).parse(await this.request("/rules")).rules as CatalogRule[]; }
  async corpusDocs(): Promise<CorpusDocOption[]> { return z.object({ docs: z.array(CorpusDocSchema) }).parse(await this.request("/corpus/docs")).docs as CorpusDocOption[]; }
  async extract(docId: string): Promise<ExtractResponse> {
    return ExtractResponseSchema.parse(await this.request(`/extract/doc/${encodeURIComponent(docId)}`, "POST")) as ExtractResponse;
  }
  async ruleVersions(teamRuleId: string): Promise<RuleVersion[]> {
    return z.object({ versions: z.array(RuleVersionSchema) }).parse(await this.request(`/rules/${encodeURIComponent(teamRuleId)}/versions`)).versions;
  }

}

let client: CiteApiClient | null = null;
export function getCiteClient(): CiteApiClient {
  if (!client) {
    const url = import.meta.env['VITE_API_URL'] as string | undefined;
    client = url ? new HttpCiteApiClient(url) : new MockCiteApiClient();
  }
  return client;
}
