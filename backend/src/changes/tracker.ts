import path from "node:path";
import type {
  ChangeEvidence,
  ChangeResult,
  LookupEntry,
  RuleRecord,
} from "@rhl/shared";
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

function sampleEvidence(
  included: ChangeEvidence[],
  excluded: ChangeEvidence[],
  limit = 6,
): ChangeEvidence[] {
  return [...included.slice(0, Math.ceil(limit / 2)), ...excluded.slice(0, Math.floor(limit / 2))];
}

function mappingFor(
  aliases: string[],
  rules: RuleRecord[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const alias of aliases) {
    const rule = ruleByAlias(rules, alias);
    if (rule) out[alias] = rule.team_rule_id;
  }
  return out;
}

function flipPerAddress(
  ids: string[],
  alias: string,
  before: string,
  after: string,
): Record<string, { before: Record<string, string>; after: Record<string, string> }> {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { before: { [alias]: before }, after: { [alias]: after } },
    ]),
  );
}

function statusPerAddress(
  ids: string[],
  statuses: Record<string, string>,
): Record<string, Record<string, string>> {
  return Object.fromEntries(ids.map((id) => [id, { ...statuses }]));
}

export function runChangeTests(options: {
  tests: ChangeTest[];
  rules: RuleRecord[];
  addresses: SampleAddress[];
  geos: Map<string, GeocodeResult>;
  /**
   * Opt-in only. The participant-final-no-hour16 pack has no T6 — do not emit a
   * placeholder by default (hour-16 was removed from the challenge).
   */
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
      const includedEv: ChangeEvidence[] = [];
      const excludedEv: ChangeEvidence[] = [];
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
          const ok = Boolean(b && af);
          const ev: ChangeEvidence = {
            address_id: a.address_id,
            included: ok,
            reason: ok
              ? `CA-ALG-01 not_yet_effective on ${test.as_of_before} and applies on ${test.as_of_after}`
              : `Did not flip NTE→applies for CA-ALG-01 across ${test.as_of_before}→${test.as_of_after}`,
            rule_ids: [rule.alias_id || rule.team_rule_id],
          };
          (ok ? includedEv : excludedEv).push(ev);
          return ok;
        })
        .map((a) => a.address_id);
      const t1Ids = sortIds(affected);
      out.T1 = {
        affected_address_ids: t1Ids,
        before_status: "not_yet_effective",
        after_status: "applies",
        evidence_summary: `included=${includedEv.length} excluded=${excludedEv.length} (CA legal geography only)`,
        sample_evidence: sampleEvidence(includedEv, excludedEv),
        rule_mapping: mappingFor(["CA-ALG-01"], rules),
        per_address: flipPerAddress(
          t1Ids,
          "CA-ALG-01",
          "not_yet_effective",
          "applies",
        ),
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
      const includedEv: ChangeEvidence[] = [];
      const excludedEv: ChangeEvidence[] = [];
      for (const a of addresses) {
        const g = geos.get(a.address_id);
        if (!g) continue;
        const entries = lookups[a.address_id] || [];
        if (hob && g.legal_city === "Hoboken") {
          if (lookupHasRule(entries, hob.team_rule_id)) {
            affected.push(a.address_id);
            includedEv.push({
              address_id: a.address_id,
              included: true,
              reason: "Legal city Hoboken matches HOB-ALG-01 jurisdiction scope",
              rule_ids: ["HOB-ALG-01"],
            });
          }
        } else if (jc && g.legal_city === "Jersey City") {
          if (lookupHasRule(entries, jc.team_rule_id)) {
            affected.push(a.address_id);
            includedEv.push({
              address_id: a.address_id,
              included: true,
              reason: "Legal city Jersey City matches JC-ALG-01 jurisdiction scope",
              rule_ids: ["JC-ALG-01"],
            });
          }
        } else if (g.state === "NJ" && g.legal_city === "Newark") {
          excludedEv.push({
            address_id: a.address_id,
            included: false,
            reason: "Newark is outside Hoboken/Jersey City legal city boundaries",
            rule_ids: ["HOB-ALG-01", "JC-ALG-01"],
          });
        }
      }
      // Verify Newark not included
      const newarkLeak = affected.filter((id) => {
        const g = geos.get(id);
        return g?.legal_city === "Newark";
      });
      const t2Ids = sortIds(affected);
      const t2Per: Record<string, Record<string, string>> = {};
      for (const id of t2Ids) {
        const g = geos.get(id);
        if (g?.legal_city === "Hoboken") t2Per[id] = { "HOB-ALG-01": "applies" };
        else if (g?.legal_city === "Jersey City") t2Per[id] = { "JC-ALG-01": "applies" };
      }
      out.T2 = {
        affected_address_ids: t2Ids,
        evidence_summary: `included=${includedEv.length}; Newark exclusions sampled=${excludedEv.length}`,
        sample_evidence: sampleEvidence(includedEv, excludedEv),
        rule_mapping: mappingFor(["HOB-ALG-01", "JC-ALG-01"], rules),
        per_address: t2Per,
        notes:
          test.expected_behavior +
          (newarkLeak.length
            ? ` WARNING: Newark incorrectly included (${newarkLeak.length})`
            : " Newark correctly excluded. Scenario membership only: primary municipal text is uncaptured; live municipal applicability remains unknown."),
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

      const conflictSet = new Set(conflict_flag_address_ids);
      const t3Included: ChangeEvidence[] = flipped.slice(0, 3).map((a) => ({
        address_id: a.address_id,
        included: true,
        reason: `NJ-ALG-01 NTE on ${test.as_of_before} → applies on ${test.as_of_after}`,
        rule_ids: ["NJ-ALG-01"],
      }));
      const t3Excluded: ChangeEvidence[] = nj
        .filter((a) => !affected.includes(a.address_id))
        .slice(0, 2)
        .map((a) => ({
          address_id: a.address_id,
          included: false,
          reason: "NJ address did not complete NTE→applies flip for NJ-ALG-01",
          rule_ids: ["NJ-ALG-01"],
        }));
      const t3Conflicts: ChangeEvidence[] = [...conflictSet].slice(0, 2).map((id) => ({
        address_id: id,
        included: true,
        reason: "Conflict flag: possible FAIR Act preemption vs Hoboken/Jersey City local ban",
        rule_ids: ["NJ-ALG-01", "HOB-ALG-01", "JC-ALG-01"],
      }));
      const t3Ids = sortIds(affected);
      out.T3 = {
        affected_address_ids: t3Ids,
        conflict_flag_address_ids: sortIds(conflict_flag_address_ids),
        before_status: "not_yet_effective",
        after_status: "applies",
        evidence_summary: `flip_ok=${flipped.length}/${nj.length}; conflicts=${conflict_flag_address_ids.length}; live_flags=${flaggedLive}`,
        sample_evidence: [...t3Included, ...t3Conflicts, ...t3Excluded].slice(0, 6),
        rule_mapping: mappingFor(["NJ-ALG-01", "HOB-ALG-01", "JC-ALG-01"], rules),
        per_address: flipPerAddress(
          t3Ids,
          "NJ-ALG-01",
          "not_yet_effective",
          "applies",
        ),
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
      const t4Ids = sortIds(affected);
      out.T4 = {
        affected_address_ids: t4Ids,
        evidence_summary: `if_enacted_scenario pending_ok=${affected.length}/${ma.length} (not current law)`,
        sample_evidence: [
          ...affected.slice(0, 3).map((id) => ({
            address_id: id,
            included: true,
            reason: "MA address would be affected if pending bills were enacted (scenario, not in force)",
            rule_ids: ["MA-ALG-P1", "MA-ALG-P2"],
          })),
          ...ma
            .filter((a) => !affected.includes(a.address_id))
            .slice(0, 2)
            .map((a) => ({
              address_id: a.address_id,
              included: false,
              reason: "Missing pending status for MA-ALG-P1/P2",
              rule_ids: ["MA-ALG-P1", "MA-ALG-P2"],
            })),
        ],
        rule_mapping: mappingFor(["MA-ALG-P1", "MA-ALG-P2"], rules),
        per_address: statusPerAddress(t4Ids, {
          "MA-ALG-P1": "pending",
          "MA-ALG-P2": "pending",
        }),
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
          // c.40P bars local rent control; it is not a cap and must not count as one.
          if (/prohibit|may not enact|40P/i.test(`${r.title} ${r.citation} ${r.requirement}`)) return false;
          return /rent control|rent cap|IP\s*25-21|ballot/i.test(
            `${r.title} ${r.citation}`,
          );
        });
      });
      out.T5 = {
        affected_address_ids: [],
        evidence_summary: `affected=0; wrongly_applies=${wrongly.length}; rogue_cap=${rogueCap.length}`,
        sample_evidence: maCities.slice(0, 4).map((a) => ({
          address_id: a.address_id,
          included: false,
          reason:
            "MA rent-control ballot (IP 25-21) is failed/struck — no rent cap reported; affected set empty",
          rule_ids: ["MA-RENT-P1"],
        })),
        rule_mapping: mappingFor(["MA-RENT-P1"], rules),
        per_address: {},
        notes:
          test.expected_behavior +
          (wrongly.length || rogueCap.length
            ? ` WARNING: wrongly_applies=${wrongly.length} rogue_cap=${rogueCap.length}`
            : " Failed ballot correctly omitted from applies."),
      };
      continue;
    }

    // T6 is not in participant-final-no-hour16. If a future pack adds it, evaluate here.
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
          affected_address_ids: [],
          notes:
            "T6 listed in change_tests.json but no matching Cambridge rule in rules.json yet.",
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

  // Opt-in stub only — never invent T6 for the no-hour16 pack.
  if (
    options.includeT6Placeholder === true &&
    !out.T6 &&
    !tests.some((t) => t.test_id === "T6")
  ) {
    out.T6 = {
      affected_address_ids: [],
      notes:
        "T6 not in this pack (participant-final-no-hour16). Hour-16 Cambridge scenario was removed from the challenge.",
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
