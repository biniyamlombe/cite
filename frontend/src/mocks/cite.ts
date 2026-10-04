/**
 * DEMONSTRATION DATA ONLY — not legal advice.
 * Fixtures mirror Cite API response shapes. Lookup fixtures are pre-baked per
 * address and as-of window; no coverage logic is evaluated here.
 */
import type { RuleVersion, AddressRow, CatalogRule, ChangesResponse, ExtractResponse, LookupResponse, LookupResult } from "@/lib/cite/types";

export const MOCK_ADDRESSES: AddressRow[] = [
  { address_id: "A0001", street_address: "1245 N Delongpre Ave", postal_city: "Los Angeles", state: "CA", zip: "90028", year_built: "1962", units: "24", legal_city: "Los Angeles", county: "Los Angeles County" },
  { address_id: "A0002", street_address: "88 Savin Hill Ave", postal_city: "Dorchester", state: "MA", zip: "02125", year_built: "1910", units: "6", legal_city: "Boston", county: "Suffolk County" },
  { address_id: "A0003", street_address: "412 Washington St", postal_city: "Hoboken", state: "NJ", zip: "07030", year_built: "1985", units: "12", legal_city: "Hoboken", county: "Hudson County" },
  { address_id: "A0004", street_address: "30 Montgomery St", postal_city: "Jersey City", state: "NJ", zip: "07302", year_built: "2019", units: "140", legal_city: "Jersey City", county: "Hudson County" },
  { address_id: "A0005", street_address: "215 Broad St", postal_city: "Newark", state: "NJ", zip: "07102", year_built: "1958", units: "32", legal_city: "Newark", county: "Essex County" },
  { address_id: "A0006", street_address: "17 Inman St", postal_city: "Cambridge", state: "MA", zip: "02139", year_built: "1925", units: "", legal_city: "Cambridge", county: "Middlesex County" },
  { address_id: "A0007", street_address: "3300 Lakeshore Ave", postal_city: "Oakland", state: "CA", zip: "94610", year_built: "", units: "8", legal_city: "Oakland", county: "Alameda County" },
  { address_id: "A0008", street_address: "901 Ocean View Rd", postal_city: "Shoreline Hts", state: "CA", zip: "95999", year_built: "1999", units: "4", legal_city: null, county: null },
];

const SRC = {
  ca1482: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1947.12&lawCode=CIV",
  ca1950: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1950.5&lawCode=CIV",
  ab325: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB325",
  laRso: "https://housing.lacity.gov/residents/rso-overview",
  njFair: "https://www.njleg.state.nj.us/bill-search/2026/S1234",
  hob: "https://ecode360.com/HO0400",
  jc: "https://ecode360.com/JE0624",
  maDep: "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B",
  maS2983: "https://malegislature.gov/Bills/194/S2983",
  maH5222: "https://malegislature.gov/Bills/194/H5222",
  maBallot: "https://www.sec.state.ma.us/divisions/elections/",
};

export const MOCK_RULES: CatalogRule[] = [
  {
    team_rule_id: "CA-1482-RENT", title: "Statewide rent cap (Tenant Protection Act)", category: "rent_increase_limits",
    citation: "Cal. Civ. Code § 1947.12(a)(1)", level: "state", jurisdiction: "California", status: "in_force",
    quoted_span: "an owner of residential real property shall not, over the course of any 12-month period, increase the gross rental rate for a dwelling or a unit more than 5 percent plus the percentage change in the cost of living, or 10 percent, whichever is lower",
    requirement: "Annual rent increases are capped at 5% + CPI, never more than 10%, for covered units.",
    source_url: SRC.ca1482, source_doc_id: "ca-civ-1947.12", precedence_note: "Where a stricter local rent ordinance (e.g. L.A. RSO) covers the unit, the local ordinance governs and this statewide cap does not apply (Cal. Civ. Code § 1947.12(d)(2)).", retrieved_at: "2026-09-14", confidence: 0.97, effective_date: "2020-01-01",
    coverage_conditions: { text: "Residential property with a certificate of occupancy more than 15 years old; not otherwise exempt." },
    exemptions: "Units covered by a stricter local rent control ordinance; housing issued a certificate of occupancy within the previous 15 years; certain single-family homes with notice.",
  },
  {
    team_rule_id: "CA-1482-JC", title: "Statewide just-cause eviction", category: "just_cause_eviction",
    citation: "Cal. Civ. Code § 1946.2(a)", level: "state", jurisdiction: "California", status: "in_force",
    quoted_span: "after a tenant has continuously and lawfully occupied a residential real property for 12 months, the owner of the residential real property shall not terminate the tenancy without just cause",
    requirement: "After 12 months of occupancy, tenancies may only be terminated for an enumerated just cause.",
    source_url: SRC.ca1482, source_doc_id: "ca-civ-1946.2", retrieved_at: "2026-09-14", confidence: 0.95, effective_date: "2020-01-01",
    coverage_conditions: "Residential real property, tenant in continuous occupancy ≥ 12 months.",
    exemptions: "Properties subject to a local just-cause ordinance that is more protective.",
  },
  {
    team_rule_id: "LA-RSO-RENT", title: "Los Angeles Rent Stabilization Ordinance", category: "rent_increase_limits",
    citation: "L.A. Mun. Code § 151.06", level: "city", jurisdiction: "Los Angeles, CA", status: "in_force",
    quoted_span: "No landlord shall demand or accept rent for a rental unit in excess of the maximum adjusted rent permitted under this chapter",
    requirement: "Allowable annual increases for RSO units are set by the Housing Department (3%–8% band).",
    source_url: SRC.laRso, source_doc_id: "la-lamc-151.06", retrieved_at: "2026-09-10", confidence: 0.93, effective_date: "1979-05-01",
    coverage_conditions: { text: "Rental unit in the City of Los Angeles with certificate of occupancy issued on or before October 1, 1978." },
    exemptions: "Units with a certificate of occupancy after October 1, 1978; government-owned housing.",
  },
  {
    team_rule_id: "CA-1950.5-DEP", title: "Security deposit limit (one month)", category: "security_deposits",
    citation: "Cal. Civ. Code § 1950.5(c)(1)", level: "state", jurisdiction: "California", status: "in_force",
    quoted_span: "A landlord may not demand or receive security, however denominated, in an amount or value in excess of an amount equal to one month's rent",
    requirement: "Security deposits may not exceed one month's rent.",
    source_url: SRC.ca1950, retrieved_at: "2026-09-14", confidence: 0.98, effective_date: "2024-07-01",
    exemptions: "Small landlords owning no more than two properties with four or fewer units total.",
  },
  {
    team_rule_id: "CA-AB325-ALGO", title: "Prohibition on common pricing algorithms", category: "algorithmic_rent_setting",
    citation: "Cal. Bus. & Prof. Code § 16729 (AB 325, 2025)", level: "state", jurisdiction: "California", status: "not_yet_effective",
    quoted_span: "It shall be unlawful for a person to use or distribute a common pricing algorithm as part of a contract, combination in the form of a trust, or conspiracy to restrain trade or commerce",
    requirement: "Landlords may not set rents using a shared pricing algorithm fed by competitor data.",
    source_url: SRC.ab325, retrieved_at: "2026-09-20", confidence: 0.9, effective_date: "2026-01-01",
    coverage_conditions: "All residential rental properties in California.",
  },
  {
    team_rule_id: "NJ-FAIR-SCREEN", title: "NJ FAIR Act — tenant screening restrictions", category: "screening_restrictions",
    citation: "N.J. P.L. 2026, c. 41, § 3", level: "state", jurisdiction: "New Jersey", status: "not_yet_effective",
    quoted_span: "A landlord shall not use an automated tenant screening tool to deny an application without providing the applicant a written notice of the specific reasons",
    requirement: "Automated screening denials require a written statement of reasons; credit-score-only denials are prohibited.",
    source_url: SRC.njFair, retrieved_at: "2026-09-22", confidence: 0.86, effective_date: "2027-07-01",
    coverage_conditions: { text: "Residential rental properties with 3 or more units in New Jersey." },
    conflict_note: "Hoboken and Jersey City ordinances impose overlapping notice requirements with different timelines. Human review required.",
    precedence_note: "No precedence determined: both city ordinances are facially applicable. Counsel should confirm which notice timeline controls.",
  },
  {
    team_rule_id: "HOB-RC-RENT", title: "Hoboken rent control", category: "rent_increase_limits",
    citation: "Hoboken City Code § 155-2", level: "city", jurisdiction: "Hoboken, NJ", status: "in_force",
    quoted_span: "the annual increase in rent shall not exceed the percentage increase in the Consumer Price Index or 5 percent, whichever is less",
    requirement: "Annual increases are limited to the lesser of CPI or 5%.",
    source_url: SRC.hob, retrieved_at: "2026-09-18", confidence: 0.94, effective_date: "1985-01-01",
    coverage_conditions: "Buildings in Hoboken with 4 or more units, constructed before 1987.",
    exemptions: "New construction for 30 years after certificate of occupancy.",
  },
  {
    team_rule_id: "JC-SCREEN-FEE", title: "Jersey City application fee cap", category: "application_screening_fees",
    citation: "Jersey City Mun. Code § 260-8", level: "city", jurisdiction: "Jersey City, NJ", status: "in_force",
    quoted_span: "No landlord shall charge a rental application fee in excess of the actual cost of the tenant screening report, not to exceed fifty dollars",
    requirement: "Application fees may not exceed actual screening cost, capped at $50.",
    source_url: SRC.jc, retrieved_at: "2026-09-18", confidence: 0.91, effective_date: "2024-03-01",
  },
  {
    team_rule_id: "MA-DEP", title: "Security deposit handling", category: "security_deposits",
    citation: "M.G.L. c. 186, § 15B(1)(b)", level: "state", jurisdiction: "Massachusetts", status: "in_force",
    quoted_span: "no lessor or his agent shall require a tenant or prospective tenant to pay any amount in excess of ... a security deposit equal to the first month's rent",
    requirement: "Deposits are capped at one month's rent and must be held in a separate interest-bearing account.",
    source_url: SRC.maDep, retrieved_at: "2026-09-11", confidence: 0.96, effective_date: "1978-01-01",
  },
  {
    team_rule_id: "MA-S2983-FEE", title: "Broker & application fee reform (S.2983)", category: "application_screening_fees",
    citation: "Mass. S.2983, 194th Gen. Ct.", level: "state", jurisdiction: "Massachusetts", status: "pending",
    quoted_span: "a landlord shall not require a tenant to pay a broker fee for a broker engaged by the landlord",
    requirement: "If enacted: tenants could not be charged broker fees for brokers hired by the landlord.",
    source_url: SRC.maS2983, retrieved_at: "2026-09-25", confidence: 0.82,
  },
  {
    team_rule_id: "MA-H5222-JC", title: "Just-cause eviction local option (H.5222)", category: "just_cause_eviction",
    citation: "Mass. H.5222, 194th Gen. Ct.", level: "state", jurisdiction: "Massachusetts", status: "pending",
    quoted_span: "a city or town may, by ordinance, require that the termination of a residential tenancy be based upon just cause",
    requirement: "If enacted: municipalities could adopt just-cause eviction protections.",
    source_url: SRC.maH5222, retrieved_at: "2026-09-25", confidence: 0.8,
  },
  {
    team_rule_id: "MA-Q-RC", title: "Rent control ballot question (2024)", category: "rent_increase_limits",
    citation: "Mass. Ballot Question (2024) — failed", level: "state", jurisdiction: "Massachusetts", status: "failed",
    quoted_span: "This proposed law would allow cities and towns to adopt rent control measures",
    requirement: "Failed at the ballot. Imposes no obligations.",
    source_url: SRC.maBallot, retrieved_at: "2026-09-02", confidence: 0.99,
  },
];

const R = (id: string, status?: CatalogRule["status"]) => {
  const { team_rule_id: _id, ...rule } = MOCK_RULES.find((r) => r.team_rule_id === id)!;
  return status ? { ...rule, status } : rule;
};
const res = (
  team_rule_id: string,
  result: LookupResult["result"],
  explanation: string,
  conflict_flag = false,
  status?: CatalogRule["status"],
): LookupResult => ({
  team_rule_id, result, explanation, conflict_flag, rule: R(team_rule_id, status),
});

type Fixture = Omit<LookupResponse, "as_of" | "disclaimer" | "address">;
/** Pre-baked fixtures keyed by address; optional as-of windows emulate backend snapshots. */
const FIXTURES: Record<string, { from?: string; data: Fixture }[]> = {
  A0001: [
    // Pre-effective AB 325 window (T1 before date)
    { data: { jurisdiction: { state: "CA", county: "Los Angeles County", city: "Los Angeles", resolution: "census", trusted: true }, results: [
      res("LA-RSO-RENT", "applies", "Built 1962, before the October 1, 1978 certificate-of-occupancy cutoff, and located in the City of Los Angeles."),
      res("CA-1482-RENT", "superseded", "The Los Angeles RSO is a stricter local rent control ordinance covering this unit, which exempts it from the statewide cap."),
      res("CA-1482-JC", "applies", "Residential property in California; no more-protective local just-cause exemption on record for this unit type."),
      res("CA-1950.5-DEP", "applies", "24 units exceeds the small-landlord exemption threshold."),
      res("CA-AB325-ALGO", "not_yet_effective", "Enacted; effective date is January 1, 2026. Not yet in force for this as-of date.", false, "not_yet_effective"),
    ] } },
    { from: "2026-01-01", data: { jurisdiction: { state: "CA", county: "Los Angeles County", city: "Los Angeles", resolution: "census", trusted: true }, results: [
      res("LA-RSO-RENT", "applies", "Built 1962, before the October 1, 1978 certificate-of-occupancy cutoff, and located in the City of Los Angeles."),
      res("CA-1482-RENT", "superseded", "The Los Angeles RSO is a stricter local rent control ordinance covering this unit, which exempts it from the statewide cap."),
      res("CA-1482-JC", "applies", "Residential property in California; no more-protective local just-cause exemption on record for this unit type."),
      res("CA-1950.5-DEP", "applies", "24 units exceeds the small-landlord exemption threshold."),
      res("CA-AB325-ALGO", "applies", "In force as of January 1, 2026; applies to all California residential rentals.", false, "in_force"),
    ] } },
  ],
  A0007: [
    { data: { jurisdiction: { state: "CA", county: "Alameda County", city: "Oakland", resolution: "census", trusted: true }, results: [
      res("CA-1482-RENT", "unknown", "Missing property fact: year built. Coverage depends on whether the certificate of occupancy is more than 15 years old."),
      res("CA-1482-JC", "applies", "Residential property in California with tenancies of 12+ months."),
      res("CA-1950.5-DEP", "applies", "8 units exceeds the small-landlord exemption threshold."),
      res("CA-AB325-ALGO", "not_yet_effective", "Enacted; effective date is January 1, 2026. Not yet in force for this as-of date.", false, "not_yet_effective"),
    ] } },
    { from: "2026-01-01", data: { jurisdiction: { state: "CA", county: "Alameda County", city: "Oakland", resolution: "census", trusted: true }, results: [
      res("CA-1482-RENT", "unknown", "Missing property fact: year built. Coverage depends on whether the certificate of occupancy is more than 15 years old."),
      res("CA-1482-JC", "applies", "Residential property in California with tenancies of 12+ months."),
      res("CA-1950.5-DEP", "applies", "8 units exceeds the small-landlord exemption threshold."),
      res("CA-AB325-ALGO", "applies", "In force as of January 1, 2026; applies to all California residential rentals.", false, "in_force"),
    ] } },
  ],
  A0008: [
    { data: { jurisdiction: { state: "CA", county: "Unknown", city: "Shoreline Hts", resolution: "postal_fallback", trusted: false }, results: [
      res("CA-1482-RENT", "applies", "Certificate of occupancy (1999) is more than 15 years old. City-level rules withheld: jurisdiction untrusted."),
      res("CA-1950.5-DEP", "unknown", "Missing property fact: owner portfolio size. The small-landlord exemption cannot be evaluated for a 4-unit property."),
      res("CA-AB325-ALGO", "not_yet_effective", "Enacted; effective date is January 1, 2026. Not yet in force for this as-of date.", false, "not_yet_effective"),
    ] } },
    { from: "2026-01-01", data: { jurisdiction: { state: "CA", county: "Unknown", city: "Shoreline Hts", resolution: "postal_fallback", trusted: false }, results: [
      res("CA-1482-RENT", "applies", "Certificate of occupancy (1999) is more than 15 years old. City-level rules withheld: jurisdiction untrusted."),
      res("CA-1950.5-DEP", "unknown", "Missing property fact: owner portfolio size. The small-landlord exemption cannot be evaluated for a 4-unit property."),
      res("CA-AB325-ALGO", "applies", "In force as of January 1, 2026; applies to all California residential rentals.", false, "in_force"),
    ] } },
  ],
  A0003: [
    { data: { jurisdiction: { state: "NJ", county: "Hudson County", city: "Hoboken", resolution: "census", trusted: true }, results: [
      res("HOB-RC-RENT", "applies", "12 units in Hoboken, constructed 1985 (before 1987)."),
      res("NJ-FAIR-SCREEN", "not_yet_effective", "Effective July 1, 2027. Property has 12 units (≥ 3). Overlaps with Hoboken screening notice rules.", true),
    ] } },
    { from: "2027-07-01", data: { jurisdiction: { state: "NJ", county: "Hudson County", city: "Hoboken", resolution: "census", trusted: true }, results: [
      res("HOB-RC-RENT", "applies", "12 units in Hoboken, constructed 1985 (before 1987)."),
      res("NJ-FAIR-SCREEN", "applies", "In force since July 1, 2027. Property has 12 units (≥ 3). Overlaps with Hoboken screening notice rules.", true),
    ] } },
  ],
  A0004: [
    { data: { jurisdiction: { state: "NJ", county: "Hudson County", city: "Jersey City", resolution: "census", trusted: true }, results: [
      res("JC-SCREEN-FEE", "applies", "Located in Jersey City; applies to all residential rental applications."),
      res("NJ-FAIR-SCREEN", "not_yet_effective", "Effective July 1, 2027. 140 units (≥ 3). Conflicts with Jersey City notice timeline.", true),
    ] } },
    { from: "2027-07-01", data: { jurisdiction: { state: "NJ", county: "Hudson County", city: "Jersey City", resolution: "census", trusted: true }, results: [
      res("JC-SCREEN-FEE", "applies", "Located in Jersey City; applies to all residential rental applications."),
      res("NJ-FAIR-SCREEN", "applies", "In force since July 1, 2027. 140 units (≥ 3). Conflicts with Jersey City notice timeline.", true),
    ] } },
  ],
  A0005: [
    { data: { jurisdiction: { state: "NJ", county: "Essex County", city: "Newark", resolution: "census", trusted: true }, results: [
      res("NJ-FAIR-SCREEN", "not_yet_effective", "Effective July 1, 2027. 32 units (≥ 3)."),
    ] } },
    { from: "2027-07-01", data: { jurisdiction: { state: "NJ", county: "Essex County", city: "Newark", resolution: "census", trusted: true }, results: [
      res("NJ-FAIR-SCREEN", "applies", "In force since July 1, 2027. 32 units (≥ 3)."),
    ] } },
  ],
  A0002: [
    { data: { jurisdiction: { state: "MA", county: "Suffolk County", city: "Boston", resolution: "known_jurisdiction", trusted: true }, results: [
      res("MA-DEP", "applies", "Residential tenancy in Massachusetts."),
      res("MA-S2983-FEE", "pending", "Bill pending in the 194th General Court. Would apply to this Boston property if enacted."),
      res("MA-H5222-JC", "pending", "Bill pending. Would enable Boston to adopt just-cause protections if enacted."),
    ] } },
  ],
  A0006: [
    { data: { jurisdiction: { state: "MA", county: "Middlesex County", city: "Cambridge", resolution: "census", trusted: true }, results: [
      res("MA-DEP", "applies", "Residential tenancy in Massachusetts."),
      res("MA-S2983-FEE", "unknown", "Missing property fact: unit count. Applicability of the pending bill depends on number of units."),
      res("MA-H5222-JC", "pending", "Bill pending. Would enable Cambridge to adopt just-cause protections if enacted."),
    ] } },
  ],
};

export function mockLookup(addressId: string, asOf: string): LookupResponse | null {
  const addr = MOCK_ADDRESSES.find((a) => a.address_id.toLowerCase() === addressId.toLowerCase());
  const windows = FIXTURES[addr?.address_id ?? ""];
  if (!addr || !windows) return null;
  const snap = [...windows].reverse().find((w) => !w.from || asOf >= w.from) ?? windows[0]!;
  const { legal_city: _l, county: _c, ...address } = addr;
  return {
    disclaimer:
      "Not legal advice and not a compliance certification. Verify important decisions with qualified counsel.",
    as_of: asOf,
    address,
    ...snap.data,
  };
}

export const MOCK_CHANGES: ChangesResponse = {
  tests: [
    { test_id: "T1", title: "California AB 325 / SB 763 takes effect", type: "effective_date_flip", expected_behavior: "Not yet effective on 2025-12-31; applies on 2026-01-02 for California addresses.", rule_ids: ["CA-AB325-ALGO"], as_of_before: "2025-12-31", as_of_after: "2026-01-02" },
    { test_id: "T2", title: "Municipal scope: Hoboken vs Jersey City", type: "jurisdiction_scope", expected_behavior: "Hoboken law reaches Hoboken only; Jersey City law reaches Jersey City only; Newark reached by neither.", rule_ids: ["HOB-RC-RENT", "JC-SCREEN-FEE"], as_of: "2026-10-01" },
    { test_id: "T3", title: "NJ FAIR Act effective date & local conflicts", type: "effective_date_flip_with_conflict", expected_behavior: "Not yet effective on 2026-10-01; applies on 2027-07-02. Hoboken and Jersey City flagged for conflict.", rule_ids: ["NJ-FAIR-SCREEN"], as_of_before: "2026-10-01", as_of_after: "2027-07-02" },
    { test_id: "T4", title: "Massachusetts S.2983 and H.5222 (pending)", type: "pending_legislation", expected_behavior: "Pending; list addresses that would be affected if enacted.", rule_ids: ["MA-S2983-FEE", "MA-H5222-JC"], as_of: "2026-10-01" },
    { test_id: "T5", title: "Failed Massachusetts rent-control ballot", type: "failed_measure", expected_behavior: "Zero affected addresses.", rule_ids: ["MA-Q-RC"], as_of: "2026-10-01" },
  ],
  results: {
    T1: { affected_address_ids: ["A0001", "A0007", "A0008"], before_status: "not_yet_effective", after_status: "applies", notes: "All California sample properties flip to Applies after the January 1, 2026 effective date." },
    T2: { affected_address_ids: ["A0003", "A0004"], notes: "A0003 (Hoboken) covered by HOB-RC-RENT only. A0004 (Jersey City) covered by JC-SCREEN-FEE only. A0005 (Newark) by neither." },
    T3: { affected_address_ids: ["A0003", "A0004", "A0005"], conflict_flag_address_ids: ["A0003", "A0004"], before_status: "not_yet_effective", after_status: "applies", notes: "Hoboken and Jersey City overlap with local screening notice ordinances; flagged for human review." },
    T4: { affected_address_ids: ["A0002", "A0006"], before_status: "pending", after_status: "pending", notes: "Would affect these Massachusetts properties if enacted. A0006 has unknown unit count for S.2983." },
    T5: { affected_address_ids: [], notes: "The measure failed. No properties are affected." },
  },
};

/** Demo fixture for GET /corpus/docs + POST /extract/doc/:docId (one option per source_doc_id). */
export const MOCK_EXTRACT_DOCS = (() => {
  const byDoc = new Map<string, { doc_id: string; title: string; jurisdiction: string; source_url?: string }>();
  for (const r of MOCK_RULES) {
    if (!r.source_doc_id || byDoc.has(r.source_doc_id)) continue;
    byDoc.set(r.source_doc_id, {
      doc_id: r.source_doc_id,
      title: r.title,
      jurisdiction: r.jurisdiction,
      source_url: r.source_url,
    });
  }
  return [...byDoc.values()].sort((a, b) => a.doc_id.localeCompare(b.doc_id));
})();

export function mockExtract(docId: string): ExtractResponse | null {
  const rules = MOCK_RULES.filter((r) => r.source_doc_id === docId);
  const first = rules[0];
  if (!first) return null;
  return {
    doc_id: docId,
    source_url: first.source_url,
    source_text: `[…] ${rules.map((r) => r.quoted_span).join(" […] ")} […]`,
    rules,
    validation: [
      { check: "Schema shape", passed: true, detail: "All required rule fields present." },
      { check: "Citation present", passed: true, detail: `Cited as ${first.citation}.` },
      { check: "Quoted span verbatim", passed: true, detail: "Quoted span found word-for-word in source text." },
      { check: "Effective date parsed", passed: !!first.effective_date, detail: first.effective_date ? `Effective ${first.effective_date}.` : "No effective date in source; flagged for review." },
      { check: "Confidence threshold", passed: (first.confidence ?? 0) >= 0.85, detail: `Model confidence ${Math.round((first.confidence ?? 0) * 100)}% (threshold 85%).` },
    ],
  };
}

/** Sample corpus history: older releases with an earlier wording, newest = current catalog text. */
export function mockRuleVersions(teamRuleId: string): RuleVersion[] {
  const r = MOCK_RULES.find((x) => x.team_rule_id === teamRuleId);
  if (!r) return [];
  const words = r.quoted_span.split(" ");
  const older = words.length > 8 ? [...words.slice(0, Math.floor(words.length * 0.6)), "as provided by regulation."].join(" ") : r.quoted_span;
  return [
    { version: "v3", corpus_release: "2026.09", released_at: "2026-09-15", status: r.status, quoted_span: r.quoted_span, change_note: "Re-extracted after source text amendment." },
    { version: "v2", corpus_release: "2026.03", released_at: "2026-03-02", status: r.status === "in_force" ? "not_yet_effective" : r.status, quoted_span: older, change_note: "Effective date confirmed from chaptered text." },
    { version: "v1", corpus_release: "2025.11", released_at: "2025-11-20", status: "pending", quoted_span: older, change_note: "Initial extraction from bill text." },
  ];
}
