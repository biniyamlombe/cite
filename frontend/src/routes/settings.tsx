import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  addSchedule,
  addWebhook,
  createKey,
  deleteSchedule,
  deleteWebhook,
  isScheduleDue,
  listAllRoles,
  listKeys,
  listSchedules,
  listWebhooks,
  myRoles,
  revokeKey,
  setRole,
  type Role,
} from "@/lib/cite/ops";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { SignInCard } from "@/components/cite/sign-in-card";

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

const input = "rounded-full border border-border/80 bg-paper/80 px-3.5 py-1.5 text-sm";
const btn =
  "rounded-full border border-border/80 px-3.5 py-1.5 text-sm hover:bg-secondary disabled:opacity-50";

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
  const t = useT();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const inv = (k: string) => () => qc.invalidateQueries({ queryKey: [k] });
  const roles = useQuery({
    queryKey: ["myroles", user?.id],
    queryFn: () => myRoles(user!.id),
    enabled: !!user,
  });
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

  const addS = useMutation({
    mutationFn: () => addSchedule(addr.trim(), freq),
    onSuccess: inv("schedules"),
  });
  const delS = useMutation({ mutationFn: deleteSchedule, onSuccess: inv("schedules") });
  const mkKey = useMutation({
    mutationFn: () => createKey(label.trim() || t("settings.keyUntitled")),
    onSuccess: (k) => {
      setNewKey(k);
      setLabel("");
      inv("keys")();
    },
  });
  const rvKey = useMutation({ mutationFn: revokeKey, onSuccess: inv("keys") });
  const addH = useMutation({
    mutationFn: () => addWebhook(url.trim()),
    onSuccess: () => {
      setUrl("");
      inv("hooks")();
    },
  });
  const delH = useMutation({ mutationFn: deleteWebhook, onSuccess: inv("hooks") });
  const chRole = useMutation({
    mutationFn: (v: { id: string; role: Role }) => setRole(v.id, v.role),
    onSuccess: inv("roles"),
  });
  const err = [addS, mkKey, addH, chRole].find((m) => m.error)?.error as Error | undefined;

  if (ready && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader eyebrow={t("nav.more.team")} title={t("settings.title")}>
          {t("settings.ledeSignedOut")}
        </PageHeader>
        <SignInCard messageKey="settings.signin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("nav.more.team")} title={t("settings.title")}>
        {t("settings.roleLabel")}{" "}
        <span className="font-mono">{roles.data?.join(", ") ?? "…"}</span>
      </PageHeader>
      {err && <p className="mt-4 text-sm text-destructive">{err.message}</p>}
      <div className="mt-8 grid gap-5">
        <Section title={t("settings.rechecks.title")} desc={t("settings.rechecks.desc")}>
          <p className="mb-3 rounded-md border border-border/70 bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("settings.rechecks.cron")}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className={input}
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder={t("settings.rechecks.placeholder")}
            />
            <select className={input} value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="daily">{t("settings.freq.daily")}</option>
              <option value="weekly">{t("settings.freq.weekly")}</option>
              <option value="monthly">{t("settings.freq.monthly")}</option>
            </select>
            <button className={btn} disabled={!addr.trim() || addS.isPending} onClick={() => addS.mutate()}>
              {t("settings.add")}
            </button>
          </div>
          <ul className="mt-3 divide-y text-sm">
            {sched.data?.map((s) => {
              const due = isScheduleDue(s.frequency, s.last_run_at);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">
                      {s.address_id} · {s.frequency}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {s.last_run_at
                        ? `${t("settings.rechecks.lastRun")} ${s.last_run_at.slice(0, 16).replace("T", " ")}`
                        : t("dashboard.notRun")}
                      {due && (
                        <span className="ml-2 rounded bg-unknown-soft px-1.5 py-0.5 font-medium text-unknown">
                          {t("settings.rechecks.due")}
                        </span>
                      )}
                      {s.last_changed && (
                        <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">
                          {t("dashboard.changed")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => delS.mutate(s.id)}
                    aria-label={t("settings.remove")}
                    className="text-muted-foreground hover:text-ink"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title={t("settings.keys.title")} desc={t("settings.keys.desc")}>
          {isViewer ? (
            <p className="text-sm text-muted-foreground">{t("settings.keys.viewer")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                className={input}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("settings.keys.placeholder")}
              />
              <button className={btn} disabled={mkKey.isPending} onClick={() => mkKey.mutate()}>
                {t("settings.keys.create")}
              </button>
            </div>
          )}
          {newKey && (
            <p className="mt-3 rounded-md border bg-secondary/50 p-3 text-sm">
              {t("settings.keys.copyOnce")}{" "}
              <code className="break-all font-mono">{newKey}</code>
            </p>
          )}
          <ul className="mt-3 divide-y text-sm">
            {keys.data?.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2">
                <span>
                  {k.label}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {k.prefix}…{" "}
                    {k.last_used_at ? `· ${t("settings.keys.used")} ${k.last_used_at.slice(0, 10)}` : ""}
                  </span>
                </span>
                {k.revoked_at ? (
                  <span className="text-xs text-muted-foreground">{t("settings.keys.revoked")}</span>
                ) : (
                  <button className={btn} onClick={() => rvKey.mutate(k.id)}>
                    {t("settings.keys.revoke")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("settings.webhooks.title")} desc={t("settings.webhooks.desc")}>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${input} min-w-72`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/cite-webhook"
            />
            <button
              className={btn}
              disabled={!/^https:\/\/\S+$/.test(url.trim()) || addH.isPending}
              onClick={() => addH.mutate()}
            >
              {t("settings.add")}
            </button>
          </div>
          <ul className="mt-3 divide-y text-sm">
            {hooks.data?.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate">{h.url}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    secret {h.secret} · last {h.last_status ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => delH.mutate(h.id)}
                  aria-label={t("settings.remove")}
                  className="text-muted-foreground hover:text-ink"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {isAdmin && (
          <Section title={t("settings.roles.title")} desc={t("settings.roles.desc")}>
            <ul className="divide-y text-sm">
              {all.data?.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs">
                    {r.user_id}
                    {r.user_id === user?.id ? ` ${t("settings.roles.you")}` : ""}
                  </span>
                  <select
                    className={input}
                    value={r.role}
                    disabled={r.user_id === user?.id}
                    onChange={(e) => chRole.mutate({ id: r.user_id, role: e.target.value as Role })}
                  >
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                    <option value="viewer">viewer</option>
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
