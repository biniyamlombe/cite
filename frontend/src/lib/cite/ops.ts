// Tier 3 team data in Lovable Cloud: roles, portfolio groups, re-check schedules, API keys, webhooks.
// None of this evaluates legal rules — it only stores preferences and copies of backend results.
import { supabase } from "@/integrations/supabase/client";

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export type Role = "admin" | "member" | "viewer";
export async function myRoles(userId: string): Promise<Role[]> {
  const rows = check(await supabase.from("user_roles").select("role").eq("user_id", userId));
  return rows.map((r) => r.role as Role);
}
export async function listAllRoles() {
  return check(
    await supabase.from("user_roles").select("id,user_id,role,created_at").order("created_at"),
  );
}
export async function setRole(userId: string, role: Role) {
  check(await supabase.from("user_roles").delete().eq("user_id", userId));
  check(await supabase.from("user_roles").insert({ user_id: userId, role }));
}

export interface Group {
  id: string;
  name: string;
  address_ids: string[];
}
export async function listGroups(): Promise<Group[]> {
  return check(await supabase.from("portfolio_groups").select("id,name,address_ids").order("name"));
}
export async function createGroup(name: string, address_ids: string[]) {
  check(await supabase.from("portfolio_groups").insert({ name, address_ids }));
}
export async function updateGroup(id: string, address_ids: string[]) {
  check(await supabase.from("portfolio_groups").update({ address_ids }).eq("id", id));
}
export async function deleteGroup(id: string) {
  check(await supabase.from("portfolio_groups").delete().eq("id", id));
}

export interface Schedule {
  id: string;
  address_id: string;
  frequency: string;
  last_run_at: string | null;
  last_changed: boolean;
  last_summary: Record<string, string> | null;
}

/** Display helper mirroring recheck.server due windows (no legal logic). */
const DUE_MS: Record<string, number> = {
  daily: 23 * 3600e3,
  weekly: 6.9 * 86400e3,
  monthly: 29 * 86400e3,
};

export function isScheduleDue(frequency: string, lastRunAt: string | null | undefined): boolean {
  const windowMs = DUE_MS[frequency] ?? 23 * 3600e3;
  return !lastRunAt || Date.now() - new Date(lastRunAt).getTime() > windowMs;
}

export async function listSchedules(): Promise<Schedule[]> {
  return check(
    await supabase
      .from("recheck_schedules")
      .select("id,address_id,frequency,last_run_at,last_changed,last_summary")
      .order("created_at"),
  ) as unknown as Schedule[];
}
export async function addSchedule(address_id: string, frequency: string) {
  check(
    await supabase
      .from("recheck_schedules")
      .upsert({ address_id, frequency }, { onConflict: "user_id,address_id" }),
  );
}
export async function deleteSchedule(id: string) {
  check(await supabase.from("recheck_schedules").delete().eq("id", id));
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function listKeys() {
  return check(
    await supabase
      .from("api_keys")
      .select("id,label,prefix,last_used_at,revoked_at,created_at")
      .order("created_at", { ascending: false }),
  );
}
/** Returns the full key once; only its SHA-256 fingerprint is stored. */
export async function createKey(label: string): Promise<string> {
  const key = `cite_${randomToken()}`;
  check(
    await supabase
      .from("api_keys")
      .insert({ label, prefix: key.slice(0, 10), key_hash: await sha256(key) }),
  );
  return key;
}
export async function revokeKey(id: string) {
  check(
    await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id),
  );
}

export async function listWebhooks() {
  return check(
    await supabase
      .from("webhooks")
      .select("id,url,secret,enabled,last_status,last_sent_at")
      .order("created_at"),
  );
}
export async function addWebhook(url: string) {
  check(await supabase.from("webhooks").insert({ url, secret: `whsec_${randomToken(16)}` }));
}
export async function deleteWebhook(id: string) {
  check(await supabase.from("webhooks").delete().eq("id", id));
}
