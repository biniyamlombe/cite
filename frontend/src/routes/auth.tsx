import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Cite" },
      {
        name: "description",
        content: "Sign in to Cite to save memos, comment on rules and get email alerts.",
      },
      { property: "og:title", content: "Sign in · Cite" },
      {
        property: "og:description",
        content: "Sign in to save memos, comment on rules and get alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const t = useT();
  const { user, ready } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"error" | "ok">("ok");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) nav({ to: "/memos" });
  }, [ready, user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    setBusy(false);
    if (r.error) {
      setMsgKind("error");
      return setMsg(r.error.message);
    }
    if (mode === "up" && !r.data.session) {
      setMsgKind("ok");
      setMsg(t("auth.confirm"));
    }
  }

  async function forgot() {
    if (!email) {
      setMsgKind("error");
      return setMsg(t("auth.email"));
    }
    setBusy(true);
    const r = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (r.error) {
      setMsgKind("error");
      return setMsg(r.error.message);
    }
    setMsgKind("ok");
    setMsg(t("auth.resetSent"));
  }

  const inputClass =
    "w-full rounded-lg border border-border/80 bg-background px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10";

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:gap-16 md:py-20">
      {/* Brand panel */}
      <div className="flex flex-col justify-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("auth.eyebrow")}
        </p>
        <h1 className="mt-4 font-serif text-4xl italic leading-[1.1] tracking-[-0.02em] text-ink sm:text-5xl">
          {t("auth.brandTitle")}
        </h1>
        <ul className="mt-8 space-y-3 border-t border-border/70 pt-6">
          {(["auth.brand1", "auth.brand2", "auth.brand3"] as const).map((k, i) => (
            <li key={k} className="flex items-baseline gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-[11px] text-primary/80">[{i + 1}]</span>
              {t(k)}
            </li>
          ))}
        </ul>
        <p className="mt-10 border-l-2 border-primary/40 pl-4 font-serif text-sm italic text-muted-foreground">
          {t("auth.quote")}
        </p>
      </div>

      {/* Form card */}
      <div className="flex flex-col justify-center">
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-7 shadow-xl shadow-ink/5 sm:p-8">
          <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
            {t("auth.eyebrow")}
          </p>
          <h2 className="mb-5 font-serif text-2xl font-semibold tracking-tight text-ink">
            {mode === "in" ? t("auth.titleIn") : t("auth.titleUp")}
          </h2>
          {/* Mode tabs */}
          <div
            role="tablist"
            className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-secondary/50 p-1"
          >
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setMsg(null);
                }}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                  mode === m
                    ? "bg-paper text-ink shadow-sm"
                    : "text-muted-foreground hover:text-ink"
                }`}
              >
                {m === "in" ? t("auth.titleIn") : t("auth.titleUp")}
              </button>
            ))}
          </div>

          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{t("auth.lede")}</p>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("auth.email")}
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("auth.password")}
                {mode === "in" && (
                  <button
                    type="button"
                    onClick={forgot}
                    className="normal-case tracking-normal text-primary hover:underline"
                  >
                    {t("auth.forgot")}
                  </button>
                )}
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow disabled:opacity-60"
            >
              {mode === "in" ? t("auth.submitIn") : t("auth.submitUp")}
            </button>
          </form>

          {msg && (
            <p
              role="status"
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                msgKind === "error"
                  ? "border-conflict/30 bg-conflict/5 text-conflict"
                  : "border-applies/30 bg-applies/5 text-applies"
              }`}
            >
              {msg}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setMsg(null);
            }}
            className="mt-5 text-sm text-primary hover:underline"
          >
            {mode === "in" ? t("auth.switchToUp") : t("auth.switchToIn")}
          </button>
        </div>
      </div>
    </div>
  );
}
