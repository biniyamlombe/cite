/**
 * Stable public Census identifiers for challenge jurisdictions.
 * Used when Census geography payloads omit GEOID fields or when offline.
 * Source: Census Bureau state/county/place FIPS (public data).
 */

export type JurisdictionIds = {
  state_fips: string | null;
  county_fips: string | null;
  place_geoid: string | null;
};

const STATE_FIPS: Record<string, string> = {
  CA: "06",
  NJ: "34",
  MA: "25",
};

/** county name (normalized) → 5-digit county FIPS */
const COUNTY_FIPS: Record<string, string> = {
  "los angeles county|CA": "06037",
  "san francisco county|CA": "06075",
  "san diego county|CA": "06073",
  "alameda county|CA": "06001",
  "orange county|CA": "06059",
  "hudson county|NJ": "34017",
  "essex county|NJ": "34013",
  "suffolk county|MA": "25025",
  "middlesex county|MA": "25017",
};

/** legal city + state → 7-digit place GEOID (state FIPS + place FIPS) */
const PLACE_GEOID: Record<string, string> = {
  "los angeles|CA": "0644000",
  "san francisco|CA": "0667000",
  "san diego|CA": "0666000",
  "berkeley|CA": "0606000",
  "santa ana|CA": "0669000",
  "jersey city|NJ": "3436000",
  "hoboken|NJ": "3432250",
  "newark|NJ": "3451000",
  "boston|MA": "2507000",
  "cambridge|MA": "2511000",
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function stateFips(state: string): string | null {
  return STATE_FIPS[state.toUpperCase()] ?? null;
}

export function resolveJurisdictionIds(options: {
  state: string;
  county?: string | null;
  legal_city?: string | null;
  trusted?: boolean;
}): JurisdictionIds {
  const state = options.state.toUpperCase();
  const state_fips = STATE_FIPS[state] ?? null;
  const countyKey = `${norm(options.county || "")}|${state}`;
  const county_fips = COUNTY_FIPS[countyKey] ?? null;
  const placeKey = `${norm(options.legal_city || "")}|${state}`;
  const place_geoid =
    options.trusted === false ? null : PLACE_GEOID[placeKey] ?? null;
  return { state_fips, county_fips, place_geoid };
}

/** Attach identifiers onto a geocode-like object without inventing place IDs for untrusted cities. */
export function withJurisdictionIds<
  T extends {
    state: string;
    county: string;
    legal_city: string;
    resolution?: string;
    state_fips?: string | null;
    county_fips?: string | null;
    place_geoid?: string | null;
  },
>(geo: T): T & JurisdictionIds {
  const trusted = (geo.resolution ?? "census") !== "postal_fallback";
  const ids = resolveJurisdictionIds({
    state: geo.state,
    county: geo.county,
    legal_city: geo.legal_city,
    trusted,
  });
  return {
    ...geo,
    state_fips: geo.state_fips || ids.state_fips || null,
    county_fips: geo.county_fips || ids.county_fips || null,
    place_geoid: trusted ? geo.place_geoid || ids.place_geoid || null : null,
  };
}
