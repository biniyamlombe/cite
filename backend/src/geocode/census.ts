import type { SampleAddress } from "../lib/addresses.js";

export type GeocodeResult = {
  address_id: string;
  legal_city: string;
  county: string;
  state: string;
  matched_address?: string;
  source: "census" | "heuristic" | "cache";
};

/** Postal city → legal city corrections when geocoder is unavailable or fails. */
const POSTAL_TO_LEGAL: Record<string, { city: string; county?: string }> = {
  "van nuys": { city: "Los Angeles", county: "Los Angeles County" },
  "north hollywood": { city: "Los Angeles", county: "Los Angeles County" },
  "sherman oaks": { city: "Los Angeles", county: "Los Angeles County" },
  "studio city": { city: "Los Angeles", county: "Los Angeles County" },
  "encino": { city: "Los Angeles", county: "Los Angeles County" },
  "tujunga": { city: "Los Angeles", county: "Los Angeles County" },
  "sun valley": { city: "Los Angeles", county: "Los Angeles County" },
  "woodland hills": { city: "Los Angeles", county: "Los Angeles County" },
  "canoga park": { city: "Los Angeles", county: "Los Angeles County" },
  "reseda": { city: "Los Angeles", county: "Los Angeles County" },
  "panorama city": { city: "Los Angeles", county: "Los Angeles County" },
  "san pedro": { city: "Los Angeles", county: "Los Angeles County" },
  "wilmington": { city: "Los Angeles", county: "Los Angeles County" },
  "harbor city": { city: "Los Angeles", county: "Los Angeles County" },
  "pacific palisades": { city: "Los Angeles", county: "Los Angeles County" },
  "hollywood": { city: "Los Angeles", county: "Los Angeles County" },
  "dorchester": { city: "Boston", county: "Suffolk County" },
  "roxbury": { city: "Boston", county: "Suffolk County" },
  "jamaica plain": { city: "Boston", county: "Suffolk County" },
  "brighton": { city: "Boston", county: "Suffolk County" },
  "allston": { city: "Boston", county: "Suffolk County" },
  "east boston": { city: "Boston", county: "Suffolk County" },
  "south boston": { city: "Boston", county: "Suffolk County" },
  "charlestown": { city: "Boston", county: "Suffolk County" },
  "hyde park": { city: "Boston", county: "Suffolk County" },
  "mattapan": { city: "Boston", county: "Suffolk County" },
  "west roxbury": { city: "Boston", county: "Suffolk County" },
  "roslindale": { city: "Boston", county: "Suffolk County" },
};

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

function heuristicGeocode(addr: SampleAddress): GeocodeResult {
  const postal = addr.postal_city.trim();
  const key = postal.toLowerCase();
  const mapped = POSTAL_TO_LEGAL[key];
  const legal_city = mapped?.city ?? postal;
  const county =
    mapped?.county ??
    STATE_COUNTY_DEFAULTS[addr.state]?.[legal_city] ??
    "";
  return {
    address_id: addr.address_id,
    legal_city,
    county,
    state: addr.state,
    matched_address: `${addr.street_address}, ${legal_city}, ${addr.state} ${addr.zip}`,
    source: "heuristic",
  };
}

/** Hard corrections when Census returns a known bad place for this sample. */
function correctGeocode(addr: SampleAddress, result: GeocodeResult): GeocodeResult {
  const postal = addr.postal_city.trim().toLowerCase();
  // Keep Cambridge, MA as Cambridge when postal city is Cambridge.
  if (addr.state === "MA" && postal === "cambridge" && result.legal_city !== "Cambridge") {
    return {
      ...result,
      legal_city: "Cambridge",
      county: "Middlesex County",
      source: "heuristic",
    };
  }
  const mapped = POSTAL_TO_LEGAL[postal];
  if (mapped && result.legal_city !== mapped.city) {
    // Prefer our postal→legal map for LA neighborhoods / Boston districts.
    return {
      ...result,
      legal_city: mapped.city,
      county: mapped.county || result.county,
      source: "heuristic",
    };
  }
  return result;
}

async function censusGeocodeOne(addr: SampleAddress): Promise<GeocodeResult | null> {
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
          geographies?: {
            "Incorporated Places"?: Array<{ NAME?: string }>;
            Counties?: Array<{ NAME?: string }>;
            States?: Array<{ STUSAB?: string; NAME?: string }>;
          };
        }>;
      };
    };
    const match = data.result?.addressMatches?.[0];
    if (!match) return null;
    const place =
      match.geographies?.["Incorporated Places"]?.[0]?.NAME?.replace(
        / city$/i,
        "",
      ) || heuristicGeocode(addr).legal_city;
    const county = match.geographies?.Counties?.[0]?.NAME || "";
    const state =
      match.geographies?.States?.[0]?.STUSAB || addr.state;
    return {
      address_id: addr.address_id,
      legal_city: place,
      county,
      state,
      matched_address: match.matchedAddress,
      source: "census",
    };
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
      results[idx] = correctGeocode(addr, raw);
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
  state: string;
  county: string;
  city: string;
} {
  return { state: g.state, county: g.county, city: g.legal_city };
}
