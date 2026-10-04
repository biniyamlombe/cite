import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import { RuleRecordSchema, type RuleRecord } from "@rhl/shared";
import { packRoot } from "./paths.js";
import { exactSpanInSource, snapQuotedSpanToSource } from "./corpus.js";

type AjvConstructor = new (opts?: object) => {
  compile: (schema: object) => ValidateFunction;
};

let ajvValidate: ValidateFunction | null = null;

async function getAjvValidator(): Promise<ValidateFunction> {
  if (ajvValidate) return ajvValidate;
  const schemaPath = path.join(packRoot(), "schema", "rule_record.schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const Ajv = Ajv2020 as unknown as AjvConstructor;
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajvValidate = ajv.compile(schema);
  return ajvValidate;
}

export async function validateRuleRecord(
  candidate: unknown,
  sourceText: string,
): Promise<{ ok: true; rule: RuleRecord } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const zod = RuleRecordSchema.safeParse(candidate);
  if (!zod.success) {
    errors.push(...zod.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const validate = await getAjvValidator();
  const forAjv =
    zod.success
      ? (() => {
          // Strip internal/enrichment fields not in organizer schema.
          const {
            alias_id: _a,
            quote_start_offset: _qs,
            quote_end_offset: _qe,
            extraction_method: _em,
            requires_human_review: _rh,
            effective_date_basis: _eb,
            status_basis: _sb,
            ...rest
          } = zod.data;
          return rest;
        })()
      : candidate;
  const ajvOk = validate(forAjv);
  if (!ajvOk && validate.errors) {
    for (const e of validate.errors as ErrorObject[]) {
      errors.push(`${e.instancePath || "/"}: ${e.message || "invalid"}`);
    }
  }
  let rule: RuleRecord | null = zod.success ? zod.data : null;
  if (rule) {
    const snapped = snapQuotedSpanToSource(rule.quoted_span, sourceText);
    if (!snapped || !exactSpanInSource(snapped, sourceText)) {
      errors.push(
        "quoted_span not found as exact contiguous text in source document",
      );
      rule = null;
    } else {
      const start = sourceText.indexOf(snapped);
      rule = {
        ...rule,
        quoted_span: snapped,
        quote_start_offset: start >= 0 ? start : null,
        quote_end_offset: start >= 0 ? start + snapped.length : null,
      };
    }
  }
  if (errors.length || !rule) {
    return { ok: false, errors: [...new Set(errors)] };
  }
  return { ok: true, rule };
}
