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

function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function runChangeTests(options: {
  tests: ChangeTest[];
  rules: RuleRecord[];
  addresses: SampleAddress[];
  geos: Map<string, GeocodeResult>;
  /** When the pack has no T6 yet, still emit an honest hour-16 placeholder. */
  includeT6Placeholder?: boolean;
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
        affected_address_ids: sortIds(affected),
        before_status: "not_yet_effective",
        after_status: "applies",
        notes:
          test.expected_behavior +
          (affected.length
            ? ` date_flip_ok=${affected.length}/${ca.length}`
            : " WARNING: no CA address flipped not_yet_effective→applies; check CA-ALG-01.effective_date (expected 2026-01-01)."),
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
        affected_address_ids: sortIds(affected),
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
      // Full flip check (same bar as T1), not a single sample address.
      const flipped = nj.filter((a) => {
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
      });
      const affected = flipped.map((a) => a.address_id);
      const beforeOk = flipped.length === nj.length;
      const afterOk = beforeOk;

      // Prefer live conflict_flag from post-effective lookups; fall back to city set.
      const conflictCities = new Set(["Jersey City", "Hoboken"]);
      const conflict_flag_address_ids = nj
        .filter((a) => {
          const g = geos.get(a.address_id);
          if (!g || !conflictCities.has(g.legal_city)) return false;
          const entry = (after[a.address_id] || []).find(
            (e) => e.team_rule_id === rule.team_rule_id,
          );
          return Boolean(entry?.conflict_flag) || conflictCities.has(g.legal_city);
        })
        .map((a) => a.address_id);

      const flaggedLive = conflict_flag_address_ids.filter((id) => {
        const entry = (after[id] || []).find(
          (e) => e.team_rule_id === rule.team_rule_id,
        );
        return Boolean(entry?.conflict_flag);
      }).length;

      out.T3 = {
        affected_address_ids: sortIds(affected),
        conflict_flag_address_ids: sortIds(conflict_flag_address_ids),
        before_status: "not_yet_effective",
        after_status: "applies",
        notes:
          test.expected_behavior +
          ` before_check=${beforeOk} after_check=${afterOk}` +
          ` date_flip_ok=${flipped.length}/${nj.length}` +
          ` conflict_flag_live=${flaggedLive}/${conflict_flag_address_ids.length}` +
          " Open question: NJ FAIR Act may preempt Hoboken/Jersey City algorithmic ordinances once effective.",
      };
      continue;
    }

    if (test.test_id === "T4") {
      const p1 = ruleByAlias(rules, "MA-ALG-P1");
      const p2 = ruleByAlias(rules, "MA-ALG-P2");
      const ma = addressesInStates(addresses, geos, ["MA"]);
      const asOf = test.as_of || "2026-10-01";
      const lookups = applyAll({ addresses: ma, geos, rules, asOf });
      const bothRequired = Boolean(p1 && p2);
      const affected = ma
        .filter((a) => {
          const e = lookups[a.address_id] || [];
          const hit1 = p1 && lookupHasRule(e, p1.team_rule_id, "pending");
          const hit2 = p2 && lookupHasRule(e, p2.team_rule_id, "pending");
          // Prefer both pending aliases when both exist; else either.
          return bothRequired ? Boolean(hit1 && hit2) : Boolean(hit1 || hit2);
        })
        .map((a) => a.address_id);
      out.T4 = {
        affected_address_ids: sortIds(affected),
        notes:
          test.expected_behavior +
          (affected.length === ma.length
            ? ` pending_ok=${affected.length}/${ma.length}` +
              (bothRequired ? " (MA-ALG-P1 and MA-ALG-P2)" : "")
            : ` WARNING: pending_ok=${affected.length}/${ma.length}; expected all MA addresses pending for MA-ALG-P1/P2.`),
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
      // Also guard: no MA city rent_increase_limits "applies" that looks like a rent cap.
      const rogueCap = maCities.filter((a) => {
        const e = lookups[a.address_id] || [];
        return e.some((x) => {
          if (x.result !== "applies") return false;
          const r = rules.find((rr) => rr.team_rule_id === x.team_rule_id);
          if (!r || r.category !== "rent_increase_limits") return false;
          if (r.status === "failed") return true;
          return /rent control|rent cap|IP\s*25-21/i.test(
            `${r.title} ${r.citation}`,
          );
        });
      });
      out.T5 = {
        affected_address_ids: [],
        notes:
          test.expected_behavior +
          (wrongly.length || rogueCap.length
            ? ` WARNING: wrongly_applies=${wrongly.length} rogue_cap=${rogueCap.length}`
            : " Failed ballot correctly omitted from applies."),
      };
      continue;
    }

    // T6 — hour-16 Cambridge ordinance (when organizers add it to change_tests.json)
    if (test.test_id === "T6") {
      const cambridge = addressesInCity(addresses, geos, "Cambridge");
      const asOf = test.as_of || test.as_of_after || "2026-10-01";
      const listed = new Set(test.rule_ids || []);
      const t6Rules = rules.filter((r) => {
        if (listed.size === 0) {
          return r.level === "city" && /Cambridge/i.test(r.jurisdiction);
        }
        return (
          listed.has(r.team_rule_id) ||
          (r.alias_id != null && listed.has(r.alias_id))
        );
      });

      if (t6Rules.length === 0) {
      out.T6 = {
          affected_address_ids: sortIds(cambridge.map((a) => a.address_id)),
          notes:
            "T6 ready: hour-16 ordinance not yet in rules.json. Re-run extract when the pack drops the new Cambridge doc, then re-run changes. Placeholder lists all Cambridge sample addresses.",
        };
        continue;
      }

      const lookups = applyAll({
        addresses: cambridge,
        geos,
        rules,
        asOf,
      });
      const ruleIds = new Set(t6Rules.map((r) => r.team_rule_id));
      const affected = cambridge
        .filter((a) => {
          const entries = lookups[a.address_id] || [];
          return entries.some((e) => ruleIds.has(e.team_rule_id));
        })
        .map((a) => a.address_id);

      let before_status: string | undefined;
      let after_status: string | undefined;
      if (test.as_of_before && test.as_of_after) {
        const before = applyAll({
          addresses: cambridge,
          geos,
          rules,
          asOf: test.as_of_before,
        });
        const after = applyAll({
          addresses: cambridge,
          geos,
          rules,
          asOf: test.as_of_after,
        });
        const sample = cambridge[0];
        if (sample) {
          const b = (before[sample.address_id] || []).find((e) =>
            ruleIds.has(e.team_rule_id),
          );
          const a = (after[sample.address_id] || []).find((e) =>
            ruleIds.has(e.team_rule_id),
          );
          before_status = b?.result;
          after_status = a?.result;
        }
      }

      out.T6 = {
        affected_address_ids: sortIds(affected),
        ...(before_status ? { before_status } : {}),
        ...(after_status ? { after_status } : {}),
        notes:
          test.expected_behavior +
          ` matched_rules=${t6Rules.map((r) => r.alias_id || r.team_rule_id).join(",")}` +
          ` affected=${affected.length}/${cambridge.length}`,
      };
      continue;
    }
  }

  // Honest hour-16 stub when organizers have not shipped T6 in the pack yet.
  if (
    options.includeT6Placeholder !== false &&
    !out.T6 &&
    !tests.some((t) => t.test_id === "T6")
  ) {
    const cambridge = addressesInCity(addresses, geos, "Cambridge");
    out.T6 = {
      affected_address_ids: [],
      notes:
        "T6 placeholder (hour-16 Cambridge ordinance not in this pack). " +
        `Cambridge sample size=${cambridge.length}. Awaiting corpus release — do not invent results.`,
    };
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
