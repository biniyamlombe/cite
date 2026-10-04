import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasUnsafeStatusDrift,
  parseLocale,
  protectTokens,
  restoreTokens,
  translateExplanationTemplate,
} from "@rhl/shared";
import { app } from "../api/server.js";
import { LookupResponseSchema } from "@rhl/shared";

test("parseLocale accepts en-US and es-US with es fallback", () => {
  assert.equal(parseLocale("en-US").locale, "en-US");
  assert.equal(parseLocale("es-US").locale, "es-US");
  assert.equal(parseLocale("es").locale, "es-US");
  assert.equal(parseLocale("fr-FR").locale, "en-US");
  assert.equal(parseLocale("fr-FR").fallback, true);
});

test("protected tokens survive protect/restore", () => {
  const source =
    "AB 325 and California Civil Code § 1946.2(a) as of 2026-10-01 at https://example.com/x";
  const { text, tokens } = protectTokens(source);
  assert.ok(text.includes("__PT"));
  assert.equal(restoreTokens(text, tokens), source);
});

test("unknown must not drift to does-not-apply Spanish", () => {
  const issues = hasUnsafeStatusDrift(
    "Coverage unknown because year built is missing.",
    "No aplica a esta propiedad.",
  );
  assert.ok(issues.includes("unknown_mapped_to_does_not_apply"));
});

test("template translation preserves dates and citations", () => {
  const en =
    "Just Cause Requirement for Eviction After 12 Months covers this address in Los Angeles, CA as of 2026-10-01. California Civil Code § 1946.2(a)";
  const out = translateExplanationTemplate(en);
  assert.ok(out);
  assert.match(out!.text, /2026-10-01/);
  assert.match(out!.text, /California Civil Code § 1946\.2\(a\)/);
  assert.match(out!.text, /parece cubrir/);
  assert.ok(!hasUnsafeStatusDrift(en, out!.text).length);
});

test("lookup?locale=es-US localizes disclaimer, labels, and plain language", async () => {
  const response = await app.request("/lookup/A0001?as_of=2026-10-01&locale=es-US");
  assert.equal(response.status, 200);
  const json = LookupResponseSchema.parse(await response.json());
  assert.equal(json.locale, "es-US");
  assert.match(json.disclaimer.toLowerCase(), /no es asesor/);
  assert.ok(json.results.length > 0);
  const first = json.results[0]!;
  assert.ok(first.plain_language_summary);
  assert.equal(first.plain_language_summary!.authoritative_language, "en");
  assert.ok(first.source_evidence?.official_quote_en);
  assert.equal(first.source_evidence?.informational_translation_es, null);
  assert.match(String(first.applicability_label ?? ""), /parece|determinar|revisión|sustitu|pendiente|vigor/i);
  // Language-neutral enums remain English codes
  assert.match(first.result, /^(applies|unknown|superseded|not_yet_effective|pending|does_not_apply)$/);
});

test("invalid locale falls back to en-US with warning", async () => {
  const response = await app.request("/lookup/A0001?as_of=2026-10-01&locale=zz-ZZ");
  assert.equal(response.status, 200);
  const json = LookupResponseSchema.parse(await response.json());
  assert.equal(json.locale, "en-US");
  assert.ok(json.locale_warning);
});

test("Spanish unknown explanation is not does-not-apply", async () => {
  const response = await app.request("/lookup/A0002?as_of=2026-10-01&locale=es-US");
  assert.equal(response.status, 200);
  const json = LookupResponseSchema.parse(await response.json());
  const unknown = json.results.find((r) => r.result === "unknown");
  if (!unknown) return;
  const text = (
    unknown.plain_language_summary?.text ?? unknown.explanation
  ).toLowerCase();
  assert.doesNotMatch(text, /\bno aplica\b/);
  assert.doesNotMatch(text, /\bno parece aplicar\b/);
});
