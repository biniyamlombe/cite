/**
 * Pack-honest coverage gaps: city pages marked link-only / check-terms with
 * no capturable body, when we also have zero extracted city-level rules.
 * Surfaces on Lookup so Newark (and similar) do not look fully covered.
 */
import type { RuleRecord } from "@rhl/shared";
import { loadManifest, type ManifestRow } from "../lib/corpus.js";
import type { GeocodeResult } from "../geocode/census.js";
import { isTrustedLegalCity } from "../geocode/census.js";

function isUncaptured(row: ManifestRow): boolean {
  const capture = (row.capture || "").toLowerCase();
  return capture === "link-only" || capture === "check-terms";
}

function isCityJurisdiction(jurisdictions: string): boolean {
  // "City, ST" — not bare state codes
  return /,\s*(CA|NJ|MA)\s*$/i.test(jurisdictions.trim());
}

function cityKey(legalCity: string, state: string): string {
  return `${legalCity.trim().toLowerCase()}|${state.trim().toUpperCase()}`;
}

function rowCityKey(jurisdictions: string): string | null {
  const m = jurisdictions
    .trim()
    .match(/^(.+?),\s*(CA|NJ|MA)\s*$/i);
  if (!m) return null;
  return cityKey(m[1]!, m[2]!);
}

function hasCityRules(
  rules: RuleRecord[],
  legalCity: string,
  state: string,
): boolean {
  const city = legalCity.trim().toLowerCase();
  const st = state.trim().toUpperCase();
  return rules.some((r) => {
    if (r.level !== "city") return false;
    const j = r.jurisdiction.trim();
    const m = j.match(/^(.+?),\s*(CA|NJ|MA)\s*$/i);
    if (!m) return false;
    return (
      m[1]!.trim().toLowerCase() === city && m[2]!.toUpperCase() === st
    );
  });
}

/**
 * Returns human-readable gap notes for the geocoded city, or [].
 */
export async function corpusGapsForGeo(
  geo: GeocodeResult,
  rules: RuleRecord[],
): Promise<string[]> {
  if (!isTrustedLegalCity(geo)) return [];
  if (hasCityRules(rules, geo.legal_city, geo.state)) return [];

  const manifest = await loadManifest();
  const key = cityKey(geo.legal_city, geo.state);
  const uncaptured = manifest.filter((row) => {
    if (!isUncaptured(row) || !isCityJurisdiction(row.jurisdictions)) {
      return false;
    }
    return rowCityKey(row.jurisdictions) === key;
  });
  if (!uncaptured.length) return [];

  const docs = uncaptured
    .map((r) => r.doc_id)
    .sort()
    .join(", ");
  const urls = uncaptured
    .map((r) => r.url)
    .filter(Boolean)
    .slice(0, 3);
  const urlPart = urls.length
    ? ` Primary pack URLs: ${urls.join("; ")}${uncaptured.length > 3 ? ` (+${uncaptured.length - 3} more)` : ""}.`
    : "";

  return [
    `${geo.legal_city}, ${geo.state} local pages ${docs} are link-only/check-terms in the pack ` +
      `(no capturable body); city-level rules beyond ${geo.state} statewide are unknown.${urlPart}`,
  ];
}
