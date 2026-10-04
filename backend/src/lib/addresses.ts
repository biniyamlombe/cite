import path from "node:path";
import { readCsv } from "./csv.js";
import { packRoot, REPO_ROOT } from "./paths.js";

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

/** Pack sample addresses only (change tests T1–T5 stay scoped to these 500). */
export async function loadAddresses(): Promise<SampleAddress[]> {
  return readCsv<SampleAddress>(
    path.join(packRoot(), "data", "sample_addresses.csv"),
  );
}

/** Stretch-goal Santa Ana demo addresses (not in the organizer pack). */
export async function loadStretchAddresses(): Promise<SampleAddress[]> {
  try {
    return await readCsv<SampleAddress>(
      path.join(REPO_ROOT, "data", "stretch", "santa_ana_addresses.csv"),
    );
  } catch {
    return [];
  }
}

/** Pack + stretch — used by the live API for demo lookups. */
export async function loadAllAddresses(): Promise<SampleAddress[]> {
  const [pack, stretch] = await Promise.all([
    loadAddresses(),
    loadStretchAddresses(),
  ]);
  return [...pack, ...stretch];
}

export function parseOptionalInt(value: string | undefined | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}
