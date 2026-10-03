import { createFileRoute } from "@tanstack/react-router";
import { DISCLAIMER } from "@/lib/cite/client";
import { PageHeader } from "@/components/cite/layout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Cite" },
      { name: "description", content: "How Cite turns legal text into traceable, deterministic regulatory answers." },
      { property: "og:title", content: "About — Cite" },
      { property: "og:description", content: "AI structures regulation. Deterministic systems evaluate applicability. Evidence supports the conclusion." },
    ],
  }),
  component: AboutPage,
});

const PIPELINE = [
  ["Corpus extract", "Legal sources are parsed into structured rule candidates."],
  ["Schema validation", "Every rule must carry a citation and verbatim quoted span."],
  ["Census jurisdiction", "Addresses resolve to their legal city, not their mailing city."],
  ["Deterministic coverage", "Coverage conditions are evaluated by code, never by a model."],
  ["Change tests", "Effective dates, pending bills, and conflicts are tested over time."],
  ["Audit log", "Every answer is reproducible from its inputs and sources."],
];

function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="About" title="Know what applies. And why." />
      <blockquote className="border-l-2 border-primary pl-5 font-serif text-2xl leading-snug text-ink">
        AI can help structure regulation. Deterministic systems evaluate applicability. Evidence supports the conclusion.
      </blockquote>
      <p className="mt-6 text-muted-foreground">
        Cite answers one question for rental-housing operators: which regulations apply to this property, why they apply, and what is about to change. Every answer is traceable:
      </p>
      <p className="mt-3 font-mono text-sm text-ink">What applies → Why it applies → What evidence supports it → What could change</p>

      <h2 className="eyebrow mt-12 mb-4">Architecture</h2>
      <ol className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        {PIPELINE.map(([t, d], i) => (
          <li key={t} className="bg-card p-5">
            <div className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1 font-medium text-ink">{t}</div>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-lg border bg-paper p-5 text-sm">
        <div className="font-medium text-ink">{DISCLAIMER}</div>
        <p className="mt-1 text-muted-foreground">Data shown in this demonstration is illustrative and must not be relied on as legal advice.</p>
      </div>
    </div>
  );
}
