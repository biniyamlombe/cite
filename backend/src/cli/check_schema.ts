/**
 * Shape-gate: prove the organizer sample validates against Zod + official Ajv schema
 * before trusting extraction. Does not require quoted_span to exist in corpus text
 * (the sample uses a placeholder span).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import { RuleRecordSchema } from "@rhl/shared";
import { appendAudit } from "../lib/audit.js";
import { packRoot } from "../lib/paths.js";

type AjvConstructor = new (opts?: object) => {
  compile: (schema: object) => ValidateFunction;
};

const REQUIRED = [
  "team_rule_id",
  "jurisdiction",
  "level",
  "category",
  "status",
  "title",
  "requirement",
  "citation",
  "source_url",
  "quoted_span",
] as const;

const CATEGORIES = [
  "rent_increase_limits",
  "just_cause_eviction",
  "security_deposits",
  "application_screening_fees",
  "screening_restrictions",
  "algorithmic_rent_setting",
] as const;

async function main() {
  const schemaPath = path.join(packRoot(), "schema", "rule_record.schema.json");
  const samplePath = path.join(packRoot(), "schema", "sample_rule_record.json");

  const schema = JSON.parse(await readFile(schemaPath, "utf8")) as {
    required?: string[];
    properties?: { category?: { enum?: string[] } };
  };
  const sample = JSON.parse(await readFile(samplePath, "utf8")) as Record<
    string,
    unknown
  >;

  const errors: string[] = [];

  const schemaRequired = schema.required ?? [];
  for (const field of REQUIRED) {
    if (!schemaRequired.includes(field)) {
      errors.push(`official schema missing required field: ${field}`);
    }
  }

  const schemaCats = schema.properties?.category?.enum ?? [];
  for (const cat of CATEGORIES) {
    if (!schemaCats.includes(cat)) {
      errors.push(`official schema missing category: ${cat}`);
    }
  }
  if (schemaCats.length !== CATEGORIES.length) {
    errors.push(
      `official schema category enum length ${schemaCats.length} !== ${CATEGORIES.length}`,
    );
  }

  const zod = RuleRecordSchema.safeParse(sample);
  if (!zod.success) {
    errors.push(
      ...zod.error.issues.map((i) => `zod ${i.path.join(".")}: ${i.message}`),
    );
  }

  const Ajv = Ajv2020 as unknown as AjvConstructor;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ajvOk = validate(sample);
  if (!ajvOk && validate.errors) {
    for (const e of validate.errors as ErrorObject[]) {
      errors.push(`ajv ${e.instancePath || "/"}: ${e.message || "invalid"}`);
    }
  }

  if (errors.length) {
    console.error("Schema shape check FAILED:");
    for (const err of errors) console.error(`  - ${err}`);
    await appendAudit({
      ts: new Date().toISOString(),
      kind: "schema_check",
      message: `FAILED: ${errors.length} error(s)`,
      meta: { errors },
    });
    process.exit(1);
  }

  await appendAudit({
    ts: new Date().toISOString(),
    kind: "schema_check",
    message: "OK — sample_rule_record.json validates (Zod + Ajv)",
  });

  console.log("Schema shape check OK");
  console.log(`  schema: ${schemaPath}`);
  console.log(`  sample: ${samplePath}`);
  console.log(`  required: ${REQUIRED.join(", ")}`);
  console.log(`  categories: ${CATEGORIES.join(", ")}`);
  console.log(
    "  note: sample quoted_span is a placeholder; corpus exactness is enforced at extract time",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
