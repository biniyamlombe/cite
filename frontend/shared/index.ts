// Local stand-in for the monorepo's shared contract package.
// Schemas validate envelope shape only and pass backend fields through unchanged.
import { z } from "zod";

export type SupportedLocale = "en-US" | "es-US";
export function parseLocale(input: string | null | undefined): { locale: SupportedLocale } {
  const v = (input ?? "").toLowerCase();
  return { locale: v.startsWith("es") ? "es-US" : "en-US" };
}

export const AsOfDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid as_of date (YYYY-MM-DD)")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Invalid as_of date");

const obj = z.object({}).passthrough();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = z.ZodType<any>;

export const HealthSchema: Loose = z.object({ ok: z.boolean() }).passthrough();
export const AddressSchema: Loose = z.object({ address_id: z.string() }).passthrough();
export const ApiRuleSchema: Loose = obj;
export const CorpusDocSchema: Loose = z.object({ doc_id: z.string() }).passthrough();
export const RuleVersionSchema: Loose = obj;
export const ExtractResponseSchema: Loose = obj;
export const ChangesResponseSchema: Loose = obj;
export const LookupResponseSchema: Loose = z
  .object({ address: obj, results: z.array(obj) })
  .passthrough();
