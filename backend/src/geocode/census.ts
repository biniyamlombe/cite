import type { SampleAddress } from "../lib/addresses.js";
import { withJurisdictionIds } from "./jurisdiction_ids.js";

/** How legal_city was obtained — postal_fallback means we did not trust the result for city rules. */
export type GeocodeResolution =
  | "census"
  | "known_jurisdiction"
  | "postal_fallback";

export type GeocodeResult = {
  address_id: string;
  legal_city: string;
  county: string;
  state: string;
  matched_address?: string;
  source: "census" | "heuristic" | "cache";
  /** Absent on older cache rows — treated as census/trusted. */
  resolution?: GeocodeResolution;
  /** Census state FIPS (2-digit), when known. */
  state_fips?: string | null;
  /** Census county FIPS (5-digit), when known. */
  county_fips?: string | null;
  /** Census place GEOID (7-digit), when legal city is trusted. */
  place_geoid?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  retrieved_at?: string | null;
  confidence?: number | null;
};

/** Postal city → legal city for challenge jurisdictions (used only when Census has no place). */
const POSTAL_TO_LEGAL: Record<string, { city: string; county?: string }> = {
  "van nuys": { city: "Los Angeles", county: "Los Angeles County" },
  "north hollywood": { city: "Los Angeles", county: "Los Angeles County" },
  "sherman oaks": { city: "Los Angeles", county: "Los Angeles County" },
  "studio city": { city: "Los Angeles", county: "Los Angeles County" },
  encino: { city: "Los Angeles", county: "Los Angeles County" },
  tujunga: { city: "Los Angeles", county: "Los Angeles County" },
  "sun valley": { city: "Los Angeles", county: "Los Angeles County" },
  "woodland hills": { city: "Los Angeles", county: "Los Angeles County" },
  "canoga park": { city: "Los Angeles", county: "Los Angeles County" },
  reseda: { city: "Los Angeles", county: "Los Angeles County" },
  "panorama city": { city: "Los Angeles", county: "Los Angeles County" },
  "san pedro": { city: "Los Angeles", county: "Los Angeles County" },
  wilmington: { city: "Los Angeles", county: "Los Angeles County" },
  "harbor city": { city: "Los Angeles", county: "Los Angeles County" },
  "pacific palisades": { city: "Los Angeles", county: "Los Angeles County" },
  venice: { city: "Los Angeles", county: "Los Angeles County" },
  "san ysidro": { city: "San Diego", county: "San Diego County" },
  dorchester: { city: "Boston", county: "Suffolk County" },
  roxbury: { city: "Boston", county: "Suffolk County" },
  "jamaica plain": { city: "Boston", county: "Suffolk County" },
  brighton: { city: "Boston", county: "Suffolk County" },
  allston: { city: "Boston", county: "Suffolk County" },
  "east boston": { city: "Boston", county: "Suffolk County" },
  "south boston": { city: "Boston", county: "Suffolk County" },
  charlestown: { city: "Boston", county: "Suffolk County" },
  "hyde park": { city: "Boston", county: "Suffolk County" },
  mattapan: { city: "Boston", county: "Suffolk County" },
  "west roxbury": { city: "Boston", county: "Suffolk County" },
  roslindale: { city: "Boston", county: "Suffolk County" },
};

/** Legal cities in the challenge pack with default counties. */
const STATE_COUNTY_DEFAULTS: Record<string, Record<string, string>> = {
  CA: {
    "Los Angeles": "Los Angeles County",
    "San Francisco": "San Francisco County",
    "San Diego": "San Diego County",
    Berkeley: "Alameda County",
    "Santa Ana": "Orange County",
  },
  NJ: {
    "Jersey City": "Hudson County",
    Hoboken: "Hudson County",
    Newark: "Essex County",
  },
  MA: {
    Boston: "Suffolk County",
    Cambridge: "Middlesex County",
  },
};

function knownLegalCity(state: string, city: string): string | undefined {
  const counties = STATE_COUNTY_DEFAULTS[state];
  if (!counties) return undefined;
  const hit = Object.keys(counties).find(
    (c) => c.toLowerCase() === city.trim().toLowerCase(),
  );
  return hit;
}

/**
 * Fallback when Census returns no match. Prefer known challenge jurisdictions;
 * never silently treat an arbitrary postal city as legal without flagging it.
 */
function heuristicGeocode(addr: SampleAddress): GeocodeResult {
  const postal = addr.postal_city.trim();
  const key = postal.toLowerCase();
  const mapped = POSTAL_TO_LEGAL[key];
  if (mapped) {
    return withJurisdictionIds({
      address_id: addr.address_id,
      legal_city: mapped.city,
      county:
        mapped.county ??
        STATE_COUNTY_DEFAULTS[addr.state]?.[mapped.city] ??
        "",
      state: addr.state,
      matched_address: `${addr.street_address}, ${mapped.city}, ${addr.state} ${addr.zip}`,
      source: "heuristic" as const,
      resolution: "known_jurisdiction" as const,
      latitude: null,
      longitude: null,
      retrieved_at: null,
      confidence: 0.7,
    });
  }

  const legal = knownLegalCity(addr.state, postal);
  if (legal) {
    return withJurisdictionIds({
      address_id: addr.address_id,
      legal_city: legal,
      county: STATE_COUNTY_DEFAULTS[addr.state]![legal]!,
      state: addr.state,
      matched_address: `${addr.street_address}, ${legal}, ${addr.state} ${addr.zip}`,
      source: "heuristic" as const,
      resolution: "known_jurisdiction" as const,
      latitude: null,
      longitude: null,
      retrieved_at: null,
      confidence: 0.75,
    });
  }

  // Last resort: keep postal for display, but mark untrusted.
  return withJurisdictionIds({
    address_id: addr.address_id,
    legal_city: postal,
    county: "",
    state: addr.state,
    matched_address: `${addr.street_address}, ${postal}, ${addr.state} ${addr.zip}`,
    source: "heuristic" as const,
    resolution: "postal_fallback" as const,
    latitude: null,
    longitude: null,
    retrieved_at: null,
    confidence: 0.2,
  });
}

/**
 * Post-process Census hits. Prefer Census incorporated place over postal city.
 * Only override for known Census mis-matches on this sample (Cambridge, MA).
 */
function correctGeocode(
  addr: SampleAddress,
  result: GeocodeResult,
): GeocodeResult {
  const postal = addr.postal_city.trim().toLowerCase();
  if (
    addr.state === "MA" &&
    postal === "cambridge" &&
    result.legal_city !== "Cambridge"
  ) {
    return {
      ...result,
      legal_city: "Cambridge",
      county: "Middlesex County",
      source: "heuristic",
      resolution: "known_jurisdiction",
    };
  }
  return result;
}

async function censusGeocodeOne(
  addr: SampleAddress,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    street: addr.street_address,
    city: addr.postal_city,
    state: addr.state,
    zip: addr.zip,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json",
  });
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/address?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x?: number; y?: number };
          geographies?: {
            "Incorporated Places"?: Array<{
              NAME?: string;
              GEOID?: string;
              PLACE?: string;
            }>;
            Counties?: Array<{ NAME?: string; GEOID?: string; COUNTY?: string }>;
            States?: Array<{
              STUSAB?: string;
              NAME?: string;
              GEOID?: string;
              STATE?: string;
            }>;
          };
        }>;
      };
    };
    const match = data.result?.addressMatches?.[0];
    if (!match) return null;

    const placeGeo = match.geographies?.["Incorporated Places"]?.[0];
    const placeName = placeGeo?.NAME;
    const place = placeName?.replace(/ city$/i, "").trim();
    if (!place) {
      // Matched coordinates but no incorporated place — do not invent from postal.
      return null;
    }

    const countyGeo = match.geographies?.Counties?.[0];
    const stateGeo = match.geographies?.States?.[0];
    const county = countyGeo?.NAME || "";
    const state = stateGeo?.STUSAB || addr.state;
    const state_fips = stateGeo?.GEOID || stateGeo?.STATE || null;
    const county_fips = countyGeo?.GEOID || null;
    const place_geoid = placeGeo?.GEOID || null;
    const longitude = match.coordinates?.x ?? null;
    const latitude = match.coordinates?.y ?? null;
    return withJurisdictionIds({
      address_id: addr.address_id,
      legal_city: place,
      county,
      state,
      matched_address: match.matchedAddress,
      source: "census" as const,
      resolution: "census" as const,
      state_fips,
      county_fips,
      place_geoid,
      latitude,
      longitude,
      retrieved_at: new Date().toISOString(),
      confidence: 0.9,
    });
  } catch {
    return null;
  }
}

export async function geocodeAddresses(
  addresses: SampleAddress[],
  options?: { useCensus?: boolean; concurrency?: number },
): Promise<GeocodeResult[]> {
  const useCensus = options?.useCensus !== false;
  const concurrency = options?.concurrency ?? 5;
  const results: GeocodeResult[] = new Array(addresses.length);

  let i = 0;
  async function worker() {
    while (i < addresses.length) {
      const idx = i++;
      const addr = addresses[idx]!;
      let result: GeocodeResult | null = null;
      if (useCensus) {
        result = await censusGeocodeOne(addr);
        // gentle rate limit
        await new Promise((r) => setTimeout(r, 100));
      }
      const raw = result ?? heuristicGeocode(addr);
      results[idx] = withJurisdictionIds(correctGeocode(addr, raw));
      if ((idx + 1) % 25 === 0) {
        process.stdout.write(`\rGeocoded ${idx + 1}/${addresses.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stdout.write(`\rGeocoded ${addresses.length}/${addresses.length}\n`);
  return results;
}

export function jurisdictionStack(g: GeocodeResult): {
  status: "resolved" | "ambiguous" | "failed" | "unknown";
  state: string;
  county: string;
  city: string;
  state_fips: string | null;
  county_fips: string | null;
  place_geoid: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  retrieved_at: string | null;
  confidence: number | null;
  resolution: GeocodeResolution;
  trusted: boolean;
} {
  const enriched = withJurisdictionIds(g);
  const resolution = enriched.resolution ?? "census";
  const trusted = resolution !== "postal_fallback";
  return {
    status: trusted ? "resolved" : "unknown",
    state: enriched.state,
    county: enriched.county,
    city: enriched.legal_city,
    state_fips: enriched.state_fips ?? null,
    county_fips: enriched.county_fips ?? null,
    place_geoid: enriched.place_geoid ?? null,
    latitude: enriched.latitude ?? null,
    longitude: enriched.longitude ?? null,
    source: enriched.source,
    retrieved_at: enriched.retrieved_at ?? null,
    confidence:
      enriched.confidence ??
      (resolution === "census" ? 0.9 : resolution === "known_jurisdiction" ? 0.7 : 0.2),
    resolution,
    trusted,
  };
}

/** City-level rules should not fire on untrusted postal-only geocodes. */
export function isTrustedLegalCity(g: GeocodeResult): boolean {
  return (g.resolution ?? "census") !== "postal_fallback";
}
