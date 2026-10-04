import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function ToolsStrip({
  address,
  asOf,
  active,
}: {
  address: string;
  asOf: string;
  active: "check" | "ask" | "lookup";
}) {
  const t = useT();
  const link =
    "rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  const on = "bg-ink text-paper";
  const off = "border border-border/80 bg-paper/80 text-muted-foreground hover:bg-secondary hover:text-ink";
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label={t("tools.nav")}>
      <Link
        to="/"
        search={{ address, as_of: asOf }}
        className={`${link} ${active === "lookup" ? on : off}`}
      >
        {t("nav.lookup")}
      </Link>
      <Link
        to="/check"
        search={{ address, as_of: asOf }}
        className={`${link} ${active === "check" ? on : off}`}
      >
        {t("nav.check")}
      </Link>
      <Link
        to="/ask"
        search={{ address, as_of: asOf }}
        className={`${link} ${active === "ask" ? on : off}`}
      >
        {t("nav.ask")}
      </Link>
    </nav>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

export function QuoteCard({
  citation,
  quote,
  meta,
  sourceUrl,
  sourceLabel,
}: {
  citation: string;
  quote: string;
  meta?: string;
  sourceUrl?: string;
  sourceLabel: string;
}) {
  return (
    <blockquote className="rounded-lg bg-quote px-4 py-3.5 sm:px-5">
      <div className="font-mono text-[11px] text-primary">
        {citation}
        {meta ? <span className="text-muted-foreground"> · {meta}</span> : null}
      </div>
      <p className="mt-2 font-serif text-[1.05rem] leading-relaxed text-ink">“{quote}”</p>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          {sourceLabel}
        </a>
      ) : null}
    </blockquote>
  );
}

export function CopyTextButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-paper/80 px-3.5 py-1.5 text-sm text-ink transition-colors hover:bg-secondary"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export function AnswerLines({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => l.startsWith("•") || l.startsWith("-"));
  const rest = lines.filter((l) => !l.startsWith("•") && !l.startsWith("-"));
  return (
    <div className="surface fade-up space-y-4 p-5 sm:p-6">
      {bullets.length > 0 ? (
        <ul className="space-y-3">
          {bullets.map((line) => {
            const body = line.replace(/^[•\-]\s*/, "");
            const [head, cite] = body.includes(" — ")
              ? (body.split(" — ") as [string, string])
              : [body, ""];
            return (
              <li key={body} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <p className="font-serif text-lg leading-snug text-ink">{head}</p>
                {cite ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{cite}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-ink">{text}</p>
      )}
      {rest.map((line) => (
        <p key={line} className="text-sm text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}
