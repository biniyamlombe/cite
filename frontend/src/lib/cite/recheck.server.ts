// Re-runs backend lookups for scheduled properties and compares the returned results
// with the previous run. No rule is evaluated here — results are copied as returned.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCiteClient } from "./client";

const DUE_MS: Record<string, number> = { daily: 23 * 3600e3, weekly: 6.9 * 86400e3, monthly: 29 * 86400e3 };

async function sign(secret: string, body: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runRechecks(db: SupabaseClient<any>, opts: { force?: boolean; userId?: string } = {}) {
  let q = db.from("recheck_schedules").select("*");
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const today = new Date().toISOString().slice(0, 10);
  let ran = 0, changed = 0, delivered = 0;
  for (const s of rows ?? []) {
    const due = !s.last_run_at || Date.now() - new Date(s.last_run_at).getTime() > (DUE_MS[s.frequency] ?? 23 * 3600e3);
    if (!opts.force && !due) continue;
    const res = await getCiteClient().lookup(s.address_id, today);
    const summary: Record<string, string> = {};
    for (const r of res.results) summary[r.team_rule_id] = r.result;
    const prev = (s.last_summary ?? null) as Record<string, string> | null;
    const diffs = prev ? Object.keys({ ...prev, ...summary }).filter((k) => prev[k] !== summary[k]).map((k) => ({ team_rule_id: k, from: prev[k] ?? null, to: summary[k] ?? null })) : [];
    const isChanged = diffs.length > 0;
    await db.from("recheck_schedules").update({ last_run_at: new Date().toISOString(), last_summary: summary, last_changed: isChanged }).eq("id", s.id);
    ran++;
    if (!isChanged) continue;
    changed++;
    const { data: hooks } = await db.from("webhooks").select("*").eq("user_id", s.user_id).eq("enabled", true);
    for (const h of hooks ?? []) {
      const body = JSON.stringify({ event: "lookup.changed", address_id: s.address_id, as_of: today, changes: diffs });
      let status = 0;
      try {
        const r = await fetch(h.url, { method: "POST", headers: { "content-type": "application/json", "x-cite-signature": await sign(h.secret, body) }, body });
        status = r.status;
        delivered++;
      } catch { status = 0; }
      await db.from("webhooks").update({ last_status: status, last_sent_at: new Date().toISOString() }).eq("id", h.id);
    }
  }
  return { ran, changed, delivered };
}
