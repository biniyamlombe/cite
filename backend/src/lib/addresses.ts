import path from "node:path";
import { readCsv } from "./csv.js";
import { packRoot } from "./paths.js";

export type SampleAddress = {
  address_id: string;
  street_address: string;
  postal_city: string;
  state: string;
  zip: string;
  year_built: string;
  units: string;
  use_code: string;
  use_description: string;
  source_dataset: string;
  retrieved_at: string;
};

export async function loadAddresses(): Promise<SampleAddress[]> {
  return readCsv<SampleAddress>(
    path.join(packRoot(), "data", "sample_addresses.csv"),
  );
}

export function parseOptionalInt(value: string | undefined | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}
