const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `Request failed: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `Request failed: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export type AddressRow = {
  address_id: string;
  street_address: string;
  postal_city: string;
  state: string;
  zip: string;
  year_built: string;
  units: string;
  legal_city?: string | null;
  county?: string | null;
};

export type LookupResponse = {
  disclaimer: string;
  as_of: string;
  address: AddressRow;
  jurisdiction: { state: string; county: string; city: string };
  results: Array<{
    team_rule_id: string;
    result: string;
    explanation: string;
    conflict_flag: boolean;
    rule: {
      title: string;
      category: string;
      citation: string;
      quoted_span: string;
      requirement: string;
      status: string;
      level: string;
      jurisdiction: string;
      source_doc_id?: string | null;
      source_url: string;
      confidence?: number | null;
      effective_date?: string | null;
    } | null;
  }>;
};

export function searchAddresses(q: string) {
  const params = new URLSearchParams({ q, limit: "30" });
  return getJson<{ count: number; addresses: AddressRow[] }>(
    `/addresses?${params}`,
  );
}

export function lookupAddress(addressId: string, asOf: string) {
  return getJson<LookupResponse>(
    `/lookup/${encodeURIComponent(addressId)}?as_of=${encodeURIComponent(asOf)}`,
  );
}

export function fetchChanges() {
  return getJson<{
    tests: Array<{
      test_id: string;
      title: string;
      type: string;
      expected_behavior: string;
      rule_ids: string[];
      as_of?: string;
      as_of_before?: string;
      as_of_after?: string;
    }>;
    results: Record<
      string,
      {
        affected_address_ids: string[];
        conflict_flag_address_ids?: string[];
        notes?: string;
        before_status?: string;
        after_status?: string;
      }
    >;
  }>("/changes");
}

export function extractDoc(docId: string) {
  return postJson<{
    doc_id: string;
    source: string;
    count: number;
    rules: unknown[];
  }>(`/extract/doc/${encodeURIComponent(docId)}`);
}

export { API_URL };
