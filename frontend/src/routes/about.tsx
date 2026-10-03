import { createFileRoute } from "@tanstack/react-router";
import { Quote } from "lucide-react";
import { useT, type StringKey } from "@/lib/i18n";
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

const STEPS: { title: StringKey; body: StringKey }[] = [
  { title: "about.step1.title", body: "about.step1.body" },
  { title: "about.step2.title", body: "about.step2.body" },
  { title: "about.step3.title", body: "about.step3.body" },
  { title: "about.step4.title", body: "about.step4.body" },
  { title: "about.step5.title", body: "about.step5.body" },
  { title: "about.step6.title", body: "about.step6.body" },
];

function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("about.eyebrow")} title={t("about.title")} />
      <blockquote className="rounded-md bg-quote/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <Quote className="mt-1 size-4 shrink-0 text-primary/70" />
          <p className="font-serif text-2xl leading-snug text-ink">{t("about.philosophy")}</p>
        </div>
      </blockquote>
      <p className="mt-6 text-muted-foreground">{t("about.body")}</p>
      <p className="mt-3 font-mono text-sm text-ink">{t("about.chain")}</p>

      <h2 className="eyebrow mt-12 mb-4">{t("about.architecture")}</h2>
      <ol className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="bg-card p-5">
            <div className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1 font-medium text-ink">{t(step.title)}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t(step.body)}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-lg border bg-paper p-5 text-sm">
        <div className="font-medium text-ink">{t("disclaimer")}</div>
        <p className="mt-1 text-muted-foreground">{t("about.demoNote")}</p>
      </div>
    </div>
  );
}
