/**
 * Deterministic rent-increase check against applying rent_increase_limits rules.
 * Never invents CPI or missing cap figures.
 */
import type { LookupEntry, RuleRecord } from "@rhl/shared";

export type CapParse = {
  pct: number | null;
  need?: "cpi" | "rate_figure";
  max?: number;
  basis?: "percent" | "formula" | "no_cap";
};

export type RentCheckVerdict = {
  kind: "ok" | "over" | "unknown" | "none";
  code: string;
  values: {
    current_rent: number;
    new_rent: number;
    increase_pct: number;
    cap_pct?: number;
    max_rent?: number;
    over_amount?: number;
  };
  need?: { key: string };
  deciding_rule_ids: string[];
  deciding_quotes: Array<{
    team_rule_id: string;
    citation: string;
    quoted_span: string;
    source_url: string;
  }>;
};

const PCT = /(\d+(?:\.\d+)?)\s*%/;

export function parseRentCap(...texts: Array<string | null | undefined>): CapParse {
  let pct: number | null = null;
  let max: number | undefined;
  let need: CapParse["need"];
  let basis: CapParse["basis"] = "percent";
  const joined = texts.filter(Boolean).join(" · ");

  if (/bar on local rent control|may not enact, maintain or enforce rent control/i.test(joined)) {
    return { pct: null, basis: "no_cap" };
  }

  const maxM = joined.match(/max(?:imum)?\s+(\d+(?:\.\d+)?)\s*%/i);
  if (maxM) max = Number(maxM[1]);

  if (/\bCPI\b/i.test(joined) && !PCT.test(joined.split("CPI")[0] ?? "")) {
    need = "cpi";
    basis = "formula";
    return { pct: null, need, max, basis };
  }

  const m = joined.match(PCT);
  if (m) pct = Number(m[1]);
  else need = "rate_figure";

  return { pct, need, max, basis };
}

export function rentVerdict(opts: {
  currentRent: number;
  newRent: number;
  cap: CapParse;
  deciding: RuleRecord[];
}): RentCheckVerdict {
  const { currentRent, newRent, cap, deciding } = opts;
  const increase_pct = Number((((newRent - currentRent) / currentRent) * 100).toFixed(2));
  const values: RentCheckVerdict["values"] = {
    current_rent: Number(currentRent.toFixed(2)),
    new_rent: Number(newRent.toFixed(2)),
    increase_pct,
  };
  const deciding_rule_ids = deciding.map((r) => r.team_rule_id);
  const deciding_quotes = deciding.map((r) => ({
    team_rule_id: r.team_rule_id,
    citation: r.citation,
    quoted_span: r.quoted_span,
    source_url: r.source_url,
  }));

  if (deciding.length === 0) {
    return {
      kind: "none",
      code: "no_applying_cap",
      values,
      deciding_rule_ids,
      deciding_quotes,
    };
  }

  if (increase_pct <= 0) {
    return {
      kind: "ok",
      code: "no_increase",
      values,
      deciding_rule_ids,
      deciding_quotes,
    };
  }

  if (cap.basis === "no_cap") {
    return {
      kind: "unknown",
      code: "no_local_cap",
      values,
      deciding_rule_ids,
      deciding_quotes,
    };
  }

  if (cap.pct == null) {
    return {
      kind: "unknown",
      code: cap.need === "cpi" ? "need_cpi" : "need_figure",
      values: cap.max != null ? { ...values, cap_pct: cap.max } : values,
      need: { key: cap.need ?? "rate_figure" },
      deciding_rule_ids,
      deciding_quotes,
    };
  }

  const max_rent = Number((currentRent * (1 + cap.pct / 100)).toFixed(2));
  values.cap_pct = cap.pct;
  values.max_rent = max_rent;
  if (newRent <= max_rent + 0.005) {
    return {
      kind: "ok",
      code: "within",
      values,
      deciding_rule_ids,
      deciding_quotes,
    };
  }
  values.over_amount = Number((newRent - max_rent).toFixed(2));
  return {
    kind: "over",
    code: "over",
    values,
    deciding_rule_ids,
    deciding_quotes,
  };
}

export function checkRentIncrease(opts: {
  currentRent: number;
  newRent: number;
  entries: LookupEntry[];
  rulesById: Map<string, RuleRecord>;
}): RentCheckVerdict {
  const applying = opts.entries
    .filter((e) => e.result === "applies")
    .map((e) => opts.rulesById.get(e.team_rule_id))
    .filter((r): r is RuleRecord => Boolean(r && r.category === "rent_increase_limits"));

  const texts = applying.flatMap((r) => [r.key_value, r.requirement, r.title]);
  const cap = parseRentCap(...texts);
  return rentVerdict({
    currentRent: opts.currentRent,
    newRent: opts.newRent,
    cap,
    deciding: applying,
  });
}
