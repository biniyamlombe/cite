import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  addSchedule, addWebhook, createKey, deleteSchedule, deleteWebhook, listAllRoles, listKeys,
  listSchedules, listWebhooks, myRoles, revokeKey, setRole, type Role,
} from "@/lib/cite/ops";
import { PageHeader } from "@/components/cite/layout";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Team & integrations — Cite" },
      { name: "description", content: "Manage team roles, scheduled re-checks, API keys and webhook notifications." },
      { property: "og:title", content: "Team & integrations — Cite" },
      { property: "og:description", content: "Roles, re-checks, API access and webhooks for Cite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

const input = "rounded-md border bg-background px-3 py-1.5 text-sm";
const btn = "rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h3 className="font-serif text-lg text-ink">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{desc}</p>
      {children}
    </section>
  );
}

function Settings() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const inv = (k: string) => () => qc.invalidateQueries({ queryKey: [k] });
  const roles = useQuery({ queryKey: ["myroles", user?.id], queryFn: () => myRoles(user!.id), enabled: !!user });
  const isAdmin = roles.data?.includes("admin");
  const isViewer = roles.data?.includes("viewer");
  const all = useQuery({ queryKey: ["roles"], queryFn: listAllRoles, enabled: !!isAdmin });
  const sched = useQuery({ queryKey: ["schedules", user?.id], queryFn: listSchedules, enabled: !!user });
  const keys = useQuery({ queryKey: ["keys"], queryFn: listKeys, enabled: !!user });
  const hooks = useQuery({ queryKey: ["hooks"], queryFn: listWebhooks, enabled: !!user });

  const [addr, setAddr] = useState("A0003");
  const [freq, setFreq] = useState("daily");
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  const addS = useMutation({ mutationFn: () => addSchedule(addr.trim(), freq), onSuccess: inv("schedules") });
  const delS = useMutation({ mutationFn: deleteSchedule, onSuccess: inv("schedules") });
  const mkKey = useMutation({ mutationFn: () => createKey(label.trim() || "Untitled"), onSuccess: (k) => { setNewKey(k); setLabel(""); inv("keys")(); } });
  const rvKey = useMutation({ mutationFn: revokeKey, onSuccess: inv("keys") });
  const addH = useMutation({ mutationFn: () => addWebhook(url.trim()), onSuccess: () => { setUrl(""); inv("hooks")(); } });
  const delH = useMutation({ mutationFn: deleteWebhook, onSuccess: inv("hooks") });
  const chRole = useMutation({ mutationFn: (v: { id: string; role: Role }) => setRole(v.id, v.role), onSuccess: inv("roles") });
  const err = [addS, mkKey, addH, chRole].find((m) => m.error)?.error as Error | undefined;

  if (ready && !user) return <div className="mx-auto max-w-6xl px-4 py-10 text-sm"><Link to="/auth" className="text-primary hover:underline">Sign in</Link> to manage team settings.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Team" title="Team & integrations">
        Your role: <span className="font-mono">{roles.data?.join(", ") ?? "…"}</span>
      </PageHeader>
      {err && <p className="mt-4 text-sm text-destructive">{err.message}</p>}
      <div className="mt-8 grid gap-5">
        <Section title="Scheduled re-checks" desc="Cite re-runs the lookup for these properties and flags any result change. Changes are also sent to your webhooks.">
          <div className="flex flex-wrap gap-2">
            <input className={input} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Property ID, e.g. A0003" />
            <select className={input} value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
            <button className={btn} disabled={!addr.trim() || addS.isPending} onClick={() => addS.mutate()}>Add</button>
          </div>
          <ul className="mt-3 divide-y text-sm">
            {sched.data?.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span className="font-mono text-xs">{s.address_id} · {s.frequency}</span>
                <button onClick={() => delS.mutate(s.id)} aria-label="Remove" className="text-muted-foreground hover:text-ink"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="API keys" desc="Let your own systems fetch lookups: GET /api/public/v1/lookup/{property}?as_of=YYYY-MM-DD with header x-api-key.">
          {isViewer ? <p className="text-sm text-muted-foreground">Viewers can't create API keys.</p> : (
            <div className="flex flex-wrap gap-2">
              <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Leasing system" />
              <button className={btn} disabled={mkKey.isPending} onClick={() => mkKey.mutate()}>Create key</button>
            </div>
          )}
          {newKey && <p className="mt-3 rounded-md border bg-secondary/50 p-3 text-sm">Copy this key now — it won't be shown again: <code className="break-all font-mono">{newKey}</code></p>}
          <ul className="mt-3 divide-y text-sm">
            {keys.data?.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2">
                <span>{k.label} <span className="font-mono text-xs text-muted-foreground">{k.prefix}… {k.last_used_at ? `· used ${k.last_used_at.slice(0, 10)}` : ""}</span></span>
                {k.revoked_at ? <span className="text-xs text-muted-foreground">revoked</span> : <button className={btn} onClick={() => rvKey.mutate(k.id)}>Revoke</button>}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Webhooks" desc="When a re-check finds a change, Cite POSTs it to these addresses, signed with the secret in the x-cite-signature header (HMAC-SHA256).">
          <div className="flex flex-wrap gap-2">
            <input className={`${input} min-w-72`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/cite-webhook" />
            <button className={btn} disabled={!/^https:\/\/\S+$/.test(url.trim()) || addH.isPending} onClick={() => addH.mutate()}>Add</button>
          </div>
          <ul className="mt-3 divide-y text-sm">
            {hooks.data?.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate">{h.url}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">secret {h.secret} · last {h.last_status ?? "—"}</div>
                </div>
                <button onClick={() => delH.mutate(h.id)} aria-label="Remove" className="text-muted-foreground hover:text-ink"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Section>

        {isAdmin && (
          <Section title="Team roles" desc="Admins manage roles. Members can do everything except manage roles; viewers can't create API keys.">
            <ul className="divide-y text-sm">
              {all.data?.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs">{r.user_id}{r.user_id === user?.id ? " (you)" : ""}</span>
                  <select className={input} value={r.role} disabled={r.user_id === user?.id} onChange={(e) => chRole.mutate({ id: r.user_id, role: e.target.value as Role })}>
                    <option value="admin">admin</option><option value="member">member</option><option value="viewer">viewer</option>
                  </select>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
