import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Scale, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCiteClient } from "@/lib/cite/client";
import { useLocale, useT, type StringKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette, CommandPaletteTrigger } from "@/components/cite/command-palette";

function AccountButton() {
  const { user, ready } = useAuth();
  const t = useT();
  if (!ready) return null;
  if (!user) {
    return (
      <Link
        to="/auth"
        className="rounded-full border border-border/80 bg-paper/80 px-3 py-1 text-xs text-ink transition-colors duration-200 hover:bg-secondary"
      >
        {t("nav.signin")}
      </Link>
    );
  }
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      title={user.email ?? ""}
      className="rounded-full border border-border/80 bg-paper/80 px-3 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-ink"
    >
      {t("nav.signout")}
    </button>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="group flex items-baseline gap-1 text-ink">
      <span className="font-serif text-[1.65rem] font-semibold leading-none tracking-[-0.03em] transition-colors duration-200 group-hover:text-primary">
        Cite
      </span>
      <sup className="font-mono text-[10px] font-medium text-primary/80 transition-transform duration-300 group-hover:-translate-y-px">
        [1]
      </sup>
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

type MoreLink = {
  to: "/dashboard" | "/portfolio" | "/bulk" | "/coverage" | "/memos" | "/settings" | "/workspace" | "/inbox";
  key: StringKey;
};

/** Tier-3 product surfaces — grouped so More reads as product structure */
const MORE_MONITOR: ReadonlyArray<MoreLink> = [
  { to: "/inbox", key: "nav.inbox" },
  { to: "/portfolio", key: "nav.portfolio" },
  { to: "/bulk", key: "nav.bulk" },
  { to: "/coverage", key: "nav.coverage" },
];

const MORE_TEAM: ReadonlyArray<MoreLink> = [
  { to: "/dashboard", key: "nav.dashboard" },
  { to: "/workspace", key: "nav.workspace" },
  { to: "/memos", key: "nav.memos" },
  { to: "/settings", key: "nav.settings" },
];

const MORE_NAV: ReadonlyArray<MoreLink> = [...MORE_MONITOR, ...MORE_TEAM];

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

  const linkClass =
    "block px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-ink";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full px-3 py-1.5 text-muted-foreground transition-all duration-200 hover:text-ink ${
          moreActive || open ? "bg-secondary text-ink font-medium shadow-sm" : ""
        }`}
      >
        {t("nav.more")}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 min-w-[12.5rem] overflow-hidden rounded-xl border border-border/80 bg-popover/95 py-1.5 shadow-dropdown backdrop-blur-xl"
        >
          <div className="px-3.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {t("nav.more.monitor")}
          </div>
          {MORE_MONITOR.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={linkClass}
              activeProps={{ className: "bg-secondary !text-ink font-medium" }}
            >
              {t(n.key)}
            </Link>
          ))}
          <div className="my-1.5 border-t border-border/60" />
          <div className="px-3.5 pb-1 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {t("nav.more.team")}
          </div>
          {MORE_TEAM.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={linkClass}
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
  const t = useT();
  return (
    <div
      className="inline-flex rounded-full border border-border/80 bg-paper/70 p-0.5 font-mono text-[11px]"
      role="group"
      aria-label={t("nav.language")}
    >
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-0.5 uppercase transition-all duration-200 ${
            locale === l ? "bg-ink text-paper shadow-sm" : "text-muted-foreground hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const mode = getCiteClient().mode;
  const t = useT();
  const [menu, setMenu] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setMenu(false), [pathname]);
  return (
    <header className="print:hidden sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto max-w-6xl rounded-2xl border border-border/70 bg-paper/80 shadow-island backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3.5 py-2.5 sm:gap-5 sm:px-5">
          <Wordmark />
          <nav aria-label={t("nav.primary")} className="hidden min-w-0 flex-1 flex-wrap items-center gap-0.5 text-sm md:flex">
            {PRIMARY_NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-2.5 py-1.5 text-muted-foreground transition-all duration-200 hover:bg-secondary/80 hover:text-ink"
                activeProps={{ className: "bg-secondary !text-ink font-medium shadow-sm" }}
              >
                {t(n.key)}
              </Link>
            ))}
            <MoreNav />
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5 md:ml-0">
            <span
              className={`hidden font-mono text-[10px] uppercase tracking-wider lg:inline ${
                mode === "live" ? "text-applies" : "text-muted-foreground/80"
              }`}
              title={t(mode === "mock" ? "mode.mock" : "mode.live")}
            >
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current opacity-80" aria-hidden />
              {t(mode === "mock" ? "mode.mock" : "mode.live")}
            </span>
            <CommandPaletteTrigger />
            <LocaleToggle />
            <AccountButton />
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-label={t("nav.menu")}
              className="inline-flex size-10 items-center justify-center rounded-full border border-border/80 text-ink transition-transform active:scale-[0.98] md:hidden"
            >
              {menu ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
        {menu && (
          <nav aria-label={t("nav.mobile")} className="border-t border-border/60 px-3 py-2 md:hidden">
            {[...PRIMARY_NAV, ...MORE_NAV].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
                activeProps={{ className: "bg-secondary !text-ink font-medium" }}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <CommandPalette />
    </header>
  );
}

export function DisclaimerBar() {
  const t = useT();
  return (
    <div className="print:static sticky bottom-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto flex max-w-6xl items-center gap-2 rounded-full border border-border/70 bg-paper/90 px-4 py-2 text-xs text-muted-foreground shadow-island backdrop-blur-xl">
        <Scale className="size-3.5 shrink-0 text-primary/70" />
        {t("disclaimer")}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 fade-up sm:mb-10">
      {eyebrow ? <div className="eyebrow text-primary/80">{eyebrow}</div> : null}
      <h1 className={`font-serif text-3xl tracking-[-0.03em] text-ink sm:text-[2.5rem] ${eyebrow ? "mt-2" : ""}`}>
        {title}
      </h1>
      {children ? (
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}
