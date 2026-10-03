// Team data stored in Lovable Cloud: saved memos, rule comments, email alert subscriptions.
// Memos store the lookup response exactly as returned — nothing is re-evaluated here.
import { supabase } from "@/integrations/supabase/client";
import type { LookupResponse } from "./types";

export interface SavedMemo {
  id: string;
  address_id: string;
  as_of: string;
  title: string;
  note: string | null;
  snapshot: LookupResponse;
  created_at: string;
}

export interface RuleComment {
  id: string;
  user_id: string;
  author_email: string;
  team_rule_id: string;
  body: string;
  created_at: string;
}

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function listMemos(): Promise<SavedMemo[]> {
  return check(await supabase.from("saved_memos").select("*").order("created_at", { ascending: false })) as unknown as SavedMemo[];
}
export async function saveMemo(d: LookupResponse, note: string | null) {
  const title = `${d.address.street_address}, ${d.address.postal_city} — as of ${d.as_of}`;
  check(
    await supabase.from("saved_memos").insert({
      address_id: d.address.address_id,
      as_of: d.as_of,
      title,
      note,
      snapshot: JSON.parse(JSON.stringify(d)),
    }),
  );
}
export async function deleteMemo(id: string) {
  check(await supabase.from("saved_memos").delete().eq("id", id));
}

export async function listComments(teamRuleId: string): Promise<RuleComment[]> {
  return check(
    await supabase.from("rule_comments").select("*").eq("team_rule_id", teamRuleId).order("created_at"),
  ) as RuleComment[];
}
export async function addComment(teamRuleId: string, body: string) {
  check(await supabase.from("rule_comments").insert({ team_rule_id: teamRuleId, body }));
}
export async function deleteComment(id: string) {
  check(await supabase.from("rule_comments").delete().eq("id", id));
}

export async function listAlertSubs(): Promise<{ address_id: string; email_enabled: boolean }[]> {
  return check(await supabase.from("alert_subscriptions").select("address_id,email_enabled"));
}
export async function setEmailAlert(addressId: string, enabled: boolean) {
  if (enabled) {
    check(await supabase.from("alert_subscriptions").upsert({ address_id: addressId, email_enabled: true }, { onConflict: "user_id,address_id" }));
  } else {
    check(await supabase.from("alert_subscriptions").delete().eq("address_id", addressId));
  }
}

export interface AuditEntry { id: string; address_id: string; as_of: string; user_email: string; summary: Record<string, number>; created_at: string }

/** Records that a lookup was viewed, with result counts copied from the response as returned. */
export async function logLookup(d: LookupResponse) {
  const summary: Record<string, number> = {};
  for (const r of d.results) summary[r.result] = (summary[r.result] ?? 0) + 1;
  summary["conflicts"] = d.results.filter((r) => r.conflict_flag).length;
  check(await supabase.from("lookup_audit").insert({ address_id: d.address.address_id, as_of: d.as_of, summary }));
}
export async function listAudit(): Promise<AuditEntry[]> {
  return check(await supabase.from("lookup_audit").select("id,address_id,as_of,user_email,summary,created_at").order("created_at", { ascending: false }).limit(500)) as unknown as AuditEntry[];
}
