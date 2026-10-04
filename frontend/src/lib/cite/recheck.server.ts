// Compares backend responses; delivery failures remain due for retry (at-least-once).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCiteClient, type CiteApiClient } from "./client";
import { diffSummaries, summarizeLookup, resultIdentity } from "./lookup-diff";
const DUE_MS: Record<string, number> = { daily: 23 * 3600e3, weekly: 6.9 * 86400e3, monthly: 29 * 86400e3 };
async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(signature)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function checked<T>(response: { data: T; error: { message: string } | null }) {
  if (response.error) throw new Error(response.error.message);
  return response.data;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runRechecks(db: SupabaseClient<any>, opts: { force?: boolean; userId?: string } = {}, client: CiteApiClient = getCiteClient()) {
  if (client.mode !== "live") throw new Error("Scheduled re-checks require a configured live API.");
  let query = db.from("recheck_schedules").select("*");
  if (opts.userId) query = query.eq("user_id", opts.userId);
  const rows = checked(await query);
  const today = new Date().toISOString().slice(0, 10);
  let ran = 0, changed = 0, delivered = 0, failed = 0, baselinesReset = 0;
  const errors: { address_id: string; message: string }[] = [];
  for (const schedule of rows ?? []) {
    const due = !schedule.last_run_at || Date.now() - new Date(schedule.last_run_at).getTime() > (DUE_MS[schedule.frequency] ?? 23 * 3600e3);
    if (!opts.force && !due) continue;
    try {
      const response = await client.lookup(schedule.address_id, today);
      const summary = summarizeLookup(response);
      const previous = schedule.last_summary as Record<string, string> | null;
      const legacy = previous && Object.values(previous).some(value => !value.startsWith("{"));
      const diffs = previous && !legacy ? diffSummaries(previous, summary) : [];
      if (diffs.length) {
        const hooks = checked(await db.from("webhooks").select("*").eq("user_id", schedule.user_id).eq("enabled", true));
        for (const hook of hooks ?? []) {
          const body = JSON.stringify({ event: "lookup.changed", address_id: schedule.address_id, as_of: today, changes: diffs.map(diff => ({
            stable_id: diff.id,
            team_rule_id: response.results.find(row => resultIdentity(row) === diff.id)?.team_rule_id ?? null,
            from: diff.from ? JSON.parse(diff.from).result : null,
            to: diff.to ? JSON.parse(diff.to).result : null,
            before: diff.from ? JSON.parse(diff.from) : null,
            after: diff.to ? JSON.parse(diff.to) : null,
          })) });
          let status = 0;
          try {
            const result = await fetch(hook.url, { method: "POST", headers: { "content-type": "application/json", "x-cite-signature": await sign(hook.secret, body) }, body, signal: AbortSignal.timeout(10000) });
            status = result.status;
            if (result.ok) delivered++;
          } catch { /* status 0 records transport failure */ }
          checked(await db.from("webhooks").update({ last_status: status, last_sent_at: new Date().toISOString() }).eq("id", hook.id));
          if (status < 200 || status >= 300) throw new Error(`Webhook delivery failed (${status}); re-check remains due.`);
        }
      }
      checked(await db.from("recheck_schedules").update({ last_run_at: new Date().toISOString(), last_summary: summary, last_changed: diffs.length > 0 }).eq("id", schedule.id));
      ran++;
      if (diffs.length) changed++;
      if (legacy) baselinesReset++;
    } catch (error) {
      failed++;
      errors.push({ address_id: schedule.address_id, message: error instanceof Error ? error.message : "Re-check failed" });
    }
  }
  return { ran, changed, delivered, failed, baselinesReset, errors };
}
