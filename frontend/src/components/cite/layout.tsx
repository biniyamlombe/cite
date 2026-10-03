import { Link, useRouterState } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCiteClient } from "@/lib/cite/client";
import { useLocale, useT, type StringKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function AccountButton() {
  const { user, ready } = useAuth();
  const t = useT();
  if (!ready) return null;
  if (!user) return <Link to="/auth" className="rounded-md border px-2.5 py-1 text-xs text-ink hover:bg-secondary">{t("nav.signin")}</Link>;
  return (
    <button onClick={() => supabase.auth.signOut()} title={user.email ?? ""}
      className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:text-ink">{t("nav.signout")}</button>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="flex items-baseline gap-1 text-ink">
      <span className="font-serif text-2xl font-semibold tracking-tight">Cite</span>
      <sup className="font-mono text-[10px] text-primary">[1]</sup>
    </Link>
  );
}

/** Judge-facing primary nav — Lookup → Change Radar → Rules → Pipeline → About */
const PRIMARY_NAV: ReadonlyArray<{
  to: "/" | "/changes" | "/rules" | "/pipeline" | "/about";
  key: StringKey;
}> = [
  { to: "/", key: "nav.lookup" },
  { to: "/changes", key: "nav.changes" },
  { to: "/rules", key: "nav.rules" },
  { to: "/pipeline", key: "nav.pipeline" },
  { to: "/about", key: "nav.about" },
];

/** Tier-3 product surfaces — collapsed so they do not distract the challenge demo */
const MORE_NAV: ReadonlyArray<{
  to: "/dashboard" | "/portfolio" | "/bulk" | "/coverage" | "/memos" | "/settings";
  key: StringKey;
}> = [
  { to: "/dashboard", key: "nav.dashboard" },
  { to: "/portfolio", key: "nav.portfolio" },
  { to: "/bulk", key: "nav.bulk" },
  { to: "/coverage", key: "nav.coverage" },
  { to: "/memos", key: "nav.memos" },
  { to: "/settings", key: "nav.settings" },
];

function MoreNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const moreActive = MORE_NAV.some((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-ink ${
          moreActive || open ? "bg-secondary !text-ink font-medium" : ""
        }`}
      >
        {t("nav.more")}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border bg-background py-1 shadow-sm"
        >
          {MORE_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-ink"
              activeProps={{ className: "bg-secondary !text-ink font-medium" }}
            >
              {t(n.key)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex rounded-md border p-0.5 font-mono text-[11px]" role="group" aria-label="Language">
      {(["en", "es"] as const).map((l) => (
        <button key={l} onClick={() => setLocale(l)} aria-pressed={locale === l}
          className={`rounded-sm px-2 py-0.5 uppercase ${locale === l ? "bg-secondary text-ink" : "text-muted-foreground hover:text-ink"}`}>{l}</button>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const mode = getCiteClient().mode;
  const t = useT();
  return (
    <header className="print:hidden sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {PRIMARY_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-ink"
              activeProps={{ className: "bg-secondary !text-ink font-medium" }}
            >
              {t(n.key)}
            </Link>
          ))}
          <MoreNav />
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
            {t(mode === "mock" ? "mode.mock" : "mode.live")}
          </span>
          <LocaleToggle />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

export function DisclaimerBar() {
  const t = useT();
  return (
    <div className="print:static sticky bottom-0 z-30 border-t bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs text-muted-foreground sm:px-6">
        <Scale className="size-3.5 shrink-0" />
        {t("disclaimer")}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted-foreground">{children}</div>}
    </div>
  );
}
