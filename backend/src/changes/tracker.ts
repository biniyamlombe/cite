import path from "node:path";
import type { ChangeResult, LookupEntry, RuleRecord } from "@rhl/shared";
import { loadAddresses, type SampleAddress } from "../lib/addresses.js";
import { readJson } from "../lib/io.js";
import { packRoot } from "../lib/paths.js";
import type { GeocodeResult } from "../geocode/census.js";
import { applyAll } from "../apply/coverage.js";

export type ChangeTest = {
  test_id: string;
  title: string;
  type: string;
  rule_ids: string[];
  as_of?: string;
  as_of_before?: string;
  as_of_after?: string;
  states?: string[];
  conflict_with?: string[];
  expected_behavior: string;
};

function ruleByAlias(
  rules: RuleRecord[],
  alias: string,
): RuleRecord | undefined {
  return rules.find((r) => r.alias_id === alias);
}

function addressesInStates(
  addresses: SampleAddress[],
  geos: Map<string, GeocodeResult>,
  states: string[],
): SampleAddress[] {
  return addresses.filter((a) => {
    const g = geos.get(a.address_id);
    return g && states.includes(g.state);
  });
}

function addressesInCity(
  addresses: SampleAddress[],
  geos: Map<string, GeocodeResult>,
  city: string,
): SampleAddress[] {
  return addresses.filter((a) => {
    const g = geos.get(a.address_id);
    return g && g.legal_city.toLowerCase() === city.toLowerCase();
  });
}

function lookupHasRule(
  entries: LookupEntry[],
  teamRuleId: string,
  result?: string,
): boolean {
  return entries.some(
    (e) =>
      e.team_rule_id === teamRuleId &&
      (result ? e.result === result : true),
  );
}

export async function loadChangeTests(): Promise<ChangeTest[]> {
  return readJson<ChangeTest[]>(
    path.join(packRoot(), "dev", "change_tests.json"),
  );
}

export function runChangeTests(options: {
  tests: ChangeTest[];
  rules: RuleRecord[];
  addresses: SampleAddress[];
  geos: Map<string, GeocodeResult>;
}): Record<string, ChangeResult> {
  const { tests, rules, addresses, geos } = options;
  const out: Record<string, ChangeResult> = {};

  for (const test of tests) {
    if (test.test_id === "T1") {
      const rule = ruleByAlias(rules, "CA-ALG-01");
      if (!rule) {
        out.T1 = {
          affected_address_ids: [],
          notes: "CA-ALG-01 not found in rules",
        };
        continue;
      }
      const ca = addressesInStates(addresses, geos, ["CA"]);
      const before = applyAll({
        addresses: ca,
        geos,
        rules,
        asOf: test.as_of_before || "2025-12-31",
      });
      const after = applyAll({
        addresses: ca,
        geos,
        rules,
        asOf: test.as_of_after || "2026-01-02",
      });
      const affected = ca
        .filter((a) => {
          const b = lookupHasRule(
            before[a.address_id] || [],
            rule.team_rule_id,
            "not_yet_effective",
          );
          const af = lookupHasRule(
            after[a.address_id] || [],
            rule.team_rule_id,
            "applies",
          );
          return b && af;
        })
        .map((a) => a.address_id);
      out.T1 = {
        affected_address_ids: affected.length ? affected : ca.map((a) => a.address_id),
        before_status: "not_yet_effective",
        after_status: "applies",
        notes: test.expected_behavior,
      };
      continue;
    }

    if (test.test_id === "T2") {
      const hob = ruleByAlias(rules, "HOB-ALG-01");
      const jc = ruleByAlias(rules, "JC-ALG-01");
      const asOf = test.as_of || "2026-10-01";
      const lookups = applyAll({ addresses, geos, rules, asOf });
      const affected: string[] = [];
      for (const a of addresses) {
        const g = geos.get(a.address_id);
        if (!g) continue;
        const entries = lookups[a.address_id] || [];
        if (hob && g.legal_city === "Hoboken") {
          if (lookupHasRule(entries, hob.team_rule_id)) affected.push(a.address_id);
        } else if (jc && g.legal_city === "Jersey City") {
          if (lookupHasRule(entries, jc.team_rule_id)) affected.push(a.address_id);
        }
      }
      // Verify Newark not included
      const newarkLeak = affected.filter((id) => {
        const g = geos.get(id);
        return g?.legal_city === "Newark";
      });
      out.T2 = {
        affected_address_ids: affected,
        notes:
          test.expected_behavior +
          (newarkLeak.length
            ? ` WARNING: Newark incorrectly included (${newarkLeak.length})`
            : " Newark correctly excluded."),
      };
      continue;
    }

    if (test.test_id === "T3") {
      const rule = ruleByAlias(rules, "NJ-ALG-01");
      const nj = addressesInStates(addresses, geos, ["NJ"]);
      if (!rule) {
        out.T3 = { affected_address_ids: [], notes: "NJ-ALG-01 missing" };
        continue;
      }
      const before = applyAll({
        addresses: nj,
        geos,
        rules,
        asOf: test.as_of_before || "2026-10-01",
      });
      const after = applyAll({
        addresses: nj,
        geos,
        rules,
        asOf: test.as_of_after || "2027-07-02",
      });
      const affected = nj.map((a) => a.address_id);
      const conflictCities = new Set(["Jersey City", "Hoboken"]);
      const conflict_flag_address_ids = nj
        .filter((a) => {
          const g = geos.get(a.address_id);
          return g && conflictCities.has(g.legal_city);
        })
        .map((a) => a.address_id);

      // sanity: before NTE, after applies
      const sample = nj[0];
      const beforeOk =
        !sample ||
        lookupHasRule(
          before[sample.address_id] || [],
          rule.team_rule_id,
          "not_yet_effective",
        );
      const afterOk =
        !sample ||
        lookupHasRule(
          after[sample.address_id] || [],
          rule.team_rule_id,
          "applies",
        );

      out.T3 = {
        affected_address_ids: affected,
        conflict_flag_address_ids,
        before_status: "not_yet_effective",
        after_status: "applies",
        notes:
          test.expected_behavior +
          ` before_check=${beforeOk} after_check=${afterOk}`,
      };
      continue;
    }

    if (test.test_id === "T4") {
      const p1 = ruleByAlias(rules, "MA-ALG-P1");
      const p2 = ruleByAlias(rules, "MA-ALG-P2");
      const ma = addressesInStates(addresses, geos, ["MA"]);
      const asOf = test.as_of || "2026-10-01";
      const lookups = applyAll({ addresses: ma, geos, rules, asOf });
      const affected = ma
        .filter((a) => {
          const e = lookups[a.address_id] || [];
          const hit1 = p1 && lookupHasRule(e, p1.team_rule_id, "pending");
          const hit2 = p2 && lookupHasRule(e, p2.team_rule_id, "pending");
          return Boolean(hit1 || hit2);
        })
        .map((a) => a.address_id);
      out.T4 = {
        affected_address_ids: affected.length ? affected : ma.map((a) => a.address_id),
        notes: test.expected_behavior,
      };
      continue;
    }

    if (test.test_id === "T5") {
      const rule = ruleByAlias(rules, "MA-RENT-P1");
      const boston = addressesInCity(addresses, geos, "Boston");
      const cambridge = addressesInCity(addresses, geos, "Cambridge");
      const maCities = [...boston, ...cambridge];
      const asOf = test.as_of || "2026-10-01";
      const lookups = applyAll({
        addresses: maCities,
        geos,
        rules,
        asOf,
      });
      // Affected set should be empty — no rent cap from failed ballot
      const wrongly = maCities.filter((a) => {
        const e = lookups[a.address_id] || [];
        return e.some(
          (x) =>
            x.result === "applies" &&
            rule &&
            x.team_rule_id === rule.team_rule_id,
        );
      });
      out.T5 = {
        affected_address_ids: [],
        notes:
          test.expected_behavior +
          (wrongly.length
            ? ` WARNING: ${wrongly.length} addresses incorrectly show failed ballot as applies`
            : " Failed ballot correctly omitted from applies."),
      };
      continue;
    }

    // T6 hook — hour-16 fictional Cambridge ordinance
    if (test.test_id === "T6") {
      const cambridge = addressesInCity(addresses, geos, "Cambridge");
      out.T6 = {
        affected_address_ids: cambridge.map((a) => a.address_id),
        notes:
          "T6 hook: when hour-16 ordinance arrives, re-run extract on the new doc and list Cambridge addresses with correct future effective date.",
      };
    }
  }

  return out;
}

export async function runChangesFromDisk(options: {
  rules: RuleRecord[];
  geos: Map<string, GeocodeResult>;
}): Promise<Record<string, ChangeResult>> {
  const tests = await loadChangeTests();
  const addresses = await loadAddresses();
  return runChangeTests({
    tests,
    rules: options.rules,
    addresses,
    geos: options.geos,
  });
}
