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
import {
  MOCK_ADDRESSES,
  MOCK_CHANGES,
  MOCK_EXTRACT_DOCS,
  MOCK_RULES,
  mockExtract,
  mockLookup,
  mockRuleVersions,
} from "@/mocks/cite";

export const DEFAULT_AS_OF = "2026-10-01";
export const DISCLAIMER = "Not legal advice. Verify important decisions with qualified counsel.";

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
    const r = mockLookup(addressId, asOf);
    if (!r) throw new Error(`Address ${addressId} not found`);
    return r;
  }
  async changes() {
    await delay();
    return MOCK_CHANGES;
  }
  async rules() {
    await delay();
    return MOCK_RULES;
  }
  async corpusDocs() {
    await delay(80);
    return MOCK_EXTRACT_DOCS;
  }
  async extract(docId: string) {
    await delay(900);
    const r = mockExtract(docId);
    if (!r) throw new Error(`Document ${docId} not found in corpus`);
    return r;
  }
  async ruleVersions(teamRuleId: string) {
    await delay();
    return mockRuleVersions(teamRuleId);
  }
}

export class HttpCiteApiClient implements CiteApiClient {
  readonly mode = "live" as const;
  constructor(private base: string) {}
  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base.replace(/\/$/, "")}${path}`);
    if (!res.ok) throw new Error(`Cite API ${res.status} on ${path}`);
    return res.json() as Promise<T>;
  }
  health() {
    return this.get<Health>("/health");
  }
  async addresses(q: string, limit = 8) {
    const r = await this.get<AddressRow[] | { addresses: AddressRow[] }>(
      `/addresses?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return Array.isArray(r) ? r : r.addresses;
  }
  lookup(addressId: string, asOf: string) {
    return this.get<LookupResponse>(`/lookup/${encodeURIComponent(addressId)}?as_of=${asOf}`);
  }
  changes() {
    return this.get<ChangesResponse>("/changes");
  }
  async rules() {
    const r = await this.get<CatalogRule[] | { rules: CatalogRule[] }>("/rules");
    return Array.isArray(r) ? r : r.rules;
  }
  async corpusDocs() {
    const r = await this.get<{ docs: CorpusDocOption[] } | CorpusDocOption[]>("/corpus/docs");
    return Array.isArray(r) ? r : r.docs;
  }
  async extract(docId: string) {
    const path = `/extract/doc/${encodeURIComponent(docId)}`;
    const res = await fetch(`${this.base.replace(/\/$/, "")}${path}`, { method: "POST" });
    if (!res.ok) throw new Error(`Cite API ${res.status} on ${path}`);
    const raw = (await res.json()) as Partial<ExtractResponse> & {
      source?: string;
      count?: number;
    };
    const out: ExtractResponse = {
      doc_id: raw.doc_id ?? docId,
      source_url: raw.source_url ?? "",
      source_text: raw.source_text ?? "",
      rules: raw.rules ?? [],
      validation: raw.validation ?? [
        {
          check: "Extract completed",
          passed: true,
          detail: `${raw.count ?? raw.rules?.length ?? 0} rule(s) from ${raw.source ?? "api"}`,
        },
      ],
    };
    if (raw.source) out.source = raw.source;
    return out;
  }
  async ruleVersions(teamRuleId: string) {
    try {
      const r = await this.get<RuleVersion[] | { versions: RuleVersion[] }>(
        `/rules/${encodeURIComponent(teamRuleId)}/versions`,
      );
      return Array.isArray(r) ? r : (r.versions ?? []);
    } catch {
      // Backend may not persist version history yet.
      return [];
    }
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
