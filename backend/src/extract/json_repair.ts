/**
 * Robust JSON recovery for Claude extraction outputs.
 * Handles markdown fences, trailing commas, and partially broken rule arrays.
 */

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

function tryParse(slice: string): unknown {
  return JSON.parse(slice);
}

function lightRepair(slice: string): string {
  return slice
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

/** Extract balanced {...} objects that look like rule records. */
function recoverRuleObjects(text: string): unknown[] {
  const rules: unknown[] = [];
  const startIndexes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") startIndexes.push(i);
  }
  for (const start of startIndexes) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i]!;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const slice = text.slice(start, i + 1);
          if (!/"category"\s*:/.test(slice) || !/"quoted_span"\s*:/.test(slice)) {
            break;
          }
          try {
            rules.push(tryParse(lightRepair(slice)));
          } catch {
            // skip unrecoverable object
          }
          break;
        }
      }
    }
  }
  return rules;
}

export function extractRulesPayload(text: string): {
  rules: unknown[];
  method: "json" | "repaired" | "recovered";
} {
  const raw = stripFences(text);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = raw.slice(start, end + 1);
    try {
      const parsed = tryParse(slice) as { rules?: unknown[] };
      if (Array.isArray(parsed?.rules)) {
        return { rules: parsed.rules, method: "json" };
      }
    } catch {
      try {
        const parsed = tryParse(lightRepair(slice)) as { rules?: unknown[] };
        if (Array.isArray(parsed?.rules)) {
          return { rules: parsed.rules, method: "repaired" };
        }
      } catch {
        // fall through to recovery
      }
    }
  }

  const recovered = recoverRuleObjects(raw);
  if (recovered.length) {
    return { rules: recovered, method: "recovered" };
  }
  throw new Error("Could not parse or recover JSON rules from model response");
}
