/**
 * Grounded Q&A over retrieved lookup results.
 * Refuses evasion; never invents rule ids or uncitable numbers.
 */
import type { LookupEntry, RuleCategory, RuleRecord } from "@rhl/shared";

const EVASION =
  /\b(get around|bypass|evade|loophole|avoid (the )?law|how do i not (pay|comply)|skirt)\b/i;
const COMPLIANCE =
  /\b(am i compliant|are we compliant|guarantee|certif(y|icate)|legal to ignore)\b/i;

const CATEGORY_HINTS: Array<{ category: RuleCategory; re: RegExp }> = [
  { category: "rent_increase_limits", re: /\brent|increase|raise|aga|cap\b/i },
  { category: "just_cause_eviction", re: /\bevict|just cause|terminate|kick out\b/i },
  { category: "security_deposits", re: /\bdeposit|interest on (the )?deposit\b/i },
  {
    category: "application_screening_fees",
    re: /\bapplication fee|screening fee|fee to apply\b/i,
  },
  { category: "screening_restrictions", re: /\bscreening|credit check|criminal history\b/i },
  {
    category: "algorithmic_rent_setting",
    re: /\balgorithm|yieldstar|pricing software|collus/i,
  },
];

export type AskCitation = {
  team_rule_id: string;
  citation: string;
  quoted_span: string;
  source_url: string;
  result: string;
};

export type AskAnswer = {
  refused: boolean;
  refusal_reason?: "evasion" | "compliance_claim";
  answer: string;
  answer_es: string;
  citations: AskCitation[];
  categories: RuleCategory[];
};

function categoriesForQuestion(q: string): RuleCategory[] {
  return CATEGORY_HINTS.filter((h) => h.re.test(q)).map((h) => h.category);
}

export function answerQuestion(opts: {
  question: string;
  entries: LookupEntry[];
  rulesById: Map<string, RuleRecord>;
  headlines?: Record<string, { headline_en: string; headline_es: string }>;
}): AskAnswer {
  const q = opts.question.trim();
  if (EVASION.test(q)) {
    return {
      refused: true,
      refusal_reason: "evasion",
      answer:
        "I can’t help with getting around a rule. Here are the applying rules with citations so you can read the source text.",
      answer_es:
        "No puedo ayudar a eludir una norma. Aquí están las normas aplicables con citas para que lea el texto fuente.",
      citations: citationsFrom(opts.entries, opts.rulesById, undefined, 6),
      categories: [],
    };
  }
  if (COMPLIANCE.test(q)) {
    return {
      refused: true,
      refusal_reason: "compliance_claim",
      answer:
        "Cite does not certify compliance. It shows retrieved rules with citations. Verify important decisions with qualified counsel.",
      answer_es:
        "Cite no certifica cumplimiento. Muestra normas recuperadas con citas. Verifique decisiones importantes con un profesional calificado.",
      citations: citationsFrom(opts.entries, opts.rulesById, undefined, 6),
      categories: [],
    };
  }

  const cats = categoriesForQuestion(q);
  const citations = citationsFrom(opts.entries, opts.rulesById, cats.length ? cats : undefined, 8);
  if (!citations.length) {
    return {
      refused: false,
      answer:
        "No matching applying or unknown rules were retrieved for this question at this address and as-of date.",
      answer_es:
        "No se recuperaron normas aplicables o desconocidas que coincidan con esta pregunta para esta dirección y fecha.",
      citations: [],
      categories: cats,
    };
  }

  const linesEn: string[] = [];
  const linesEs: string[] = [];
  for (const c of citations.slice(0, 4)) {
    const h = opts.headlines?.[c.team_rule_id];
    const en = cleanHeadline(h?.headline_en) || c.citation;
    const es = cleanHeadline(h?.headline_es) || c.citation;
    linesEn.push(`• ${en} — ${c.citation}`);
    linesEs.push(`• ${es} — ${c.citation}`);
  }
  linesEn.push("Not legal advice. Read the cited source text before relying on this.");
  linesEs.push(
    "No es asesoría legal. Lea el texto fuente citado antes de confiar en esto.",
  );

  return {
    refused: false,
    answer: linesEn.join("\n"),
    answer_es: linesEs.join("\n"),
    citations,
    categories: cats,
  };
}

/** Drop leaked JSON blobs from older headline artifacts. */
function cleanHeadline(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  if (!t.includes("{")) return t;
  const cut = t.indexOf("{");
  const head = t.slice(0, cut).replace(/[:(]\s*$/, "").trim();
  return head || undefined;
}

function citationsFrom(
  entries: LookupEntry[],
  rulesById: Map<string, RuleRecord>,
  categories: RuleCategory[] | undefined,
  limit: number,
): AskCitation[] {
  const prefer = new Set(["applies", "unknown", "not_yet_effective", "pending"]);
  const out: AskCitation[] = [];
  for (const e of entries) {
    if (!prefer.has(e.result)) continue;
    const rule = rulesById.get(e.team_rule_id);
    if (!rule) continue;
    if (categories && !categories.includes(rule.category)) continue;
    out.push({
      team_rule_id: rule.team_rule_id,
      citation: rule.citation,
      quoted_span: rule.quoted_span,
      source_url: rule.source_url,
      result: e.result,
    });
    if (out.length >= limit) break;
  }
  return out;
}
