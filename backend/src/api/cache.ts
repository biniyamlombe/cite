import fs from "node:fs";
import path from "node:path";
import {
  RulesFileSchema,
  type RuleRecord,
} from "@rhl/shared";
import { loadAllAddresses, type SampleAddress } from "../lib/addresses.js";
import { readJsonIfExists } from "../lib/io.js";
import { outputsDir } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import { loadCapturableDocs } from "../lib/corpus.js";

type CacheEntry<T> = { value: T; mtimeKey: string };

let rulesCache: CacheEntry<RuleRecord[]> | null = null;
let addressesCache: CacheEntry<SampleAddress[]> | null = null;
let geosCache: CacheEntry<Map<string, GeocodeResult>> | null = null;
let retrievedCache: CacheEntry<Map<string, string>> | null = null;

function mtimeKey(paths: string[]): string {
  return paths
    .map((p) => {
      try {
        return `${p}:${fs.statSync(p).mtimeMs}`;
      } catch {
        return `${p}:missing`;
      }
    })
    .join("|");
}

export async function cachedRules(): Promise<RuleRecord[]> {
  const file = path.join(outputsDir(), "rules.json");
  const key = mtimeKey([file]);
  if (rulesCache?.mtimeKey === key) return rulesCache.value;
  const raw = await readJsonIfExists<{ rules: RuleRecord[] }>(file);
  const value = raw ? RulesFileSchema.parse(raw).rules : [];
  rulesCache = { value, mtimeKey: key };
  return value;
}

export async function cachedAddresses(): Promise<SampleAddress[]> {
  const pack = path.join(
    process.env.PACK_ROOT || path.join(process.cwd(), "data/pack"),
    "data",
    "sample_addresses.csv",
  );
  const stretch = path.join(process.cwd(), "data/stretch/santa_ana_addresses.csv");
  const key = mtimeKey([pack, stretch]);
  if (addressesCache?.mtimeKey === key) return addressesCache.value;
  const value = await loadAllAddresses();
  addressesCache = { value, mtimeKey: key };
  return value;
}

export async function cachedGeos(): Promise<Map<string, GeocodeResult>> {
  const pack = path.join(outputsDir(), "geocode_cache.json");
  const stretch = path.join(outputsDir(), "stretch_geocode.json");
  const key = mtimeKey([pack, stretch]);
  if (geosCache?.mtimeKey === key) return geosCache.value;
  const packGeo = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(pack);
  const stretchGeo = await readJsonIfExists<{ geocoded: GeocodeResult[] }>(stretch);
  const value = new Map(
    [...(packGeo?.geocoded ?? []), ...(stretchGeo?.geocoded ?? [])].map((g) => [
      g.address_id,
      g,
    ]),
  );
  geosCache = { value, mtimeKey: key };
  return value;
}

export async function cachedRetrievedAtByDocId(): Promise<Map<string, string>> {
  const key = "corpus";
  if (retrievedCache?.mtimeKey === key) return retrievedCache.value;
  const docs = await loadCapturableDocs();
  const value = new Map(
    docs
      .filter((d) => Boolean(d.retrieved_at))
      .map((d) => [d.doc_id, d.retrieved_at]),
  );
  retrievedCache = { value, mtimeKey: key };
  return value;
}
