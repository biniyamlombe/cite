import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · Cite" },
      { name: "description", content: "Set a new password for your Cite account." },
      { property: "og:title", content: "Reset password · Cite" },
      { property: "og:description", content: "Set a new password for your Cite account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const t = useT();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<"error" | "ok">("ok");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (r.error) {
      setKind("error");
      return setMsg(r.error.message);
    }
    setKind("ok");
    setMsg(t("reset.done"));
    setTimeout(() => nav({ to: "/auth" }), 1500);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
        {t("auth.eyebrow")}
      </p>
      <h1 className="mt-3 font-serif text-4xl italic tracking-[-0.02em] text-ink">
        {t("reset.title")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{t("reset.lede")}</p>

      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-7 shadow-xl shadow-ink/5"
      >
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("auth.newPassword")}
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border/80 bg-background px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {t("reset.submit")}
        </button>
        {msg && (
          <p
            role="status"
            className={`rounded-lg border px-3 py-2 text-sm ${
              kind === "error"
                ? "border-conflict/30 bg-conflict/5 text-conflict"
                : "border-applies/30 bg-applies/5 text-applies"
            }`}
          >
            {msg}
          </p>
        )}
        <Link to="/auth" className="block text-sm text-primary hover:underline">
          {t("reset.back")}
        </Link>
      </form>
    </div>
  );
}
