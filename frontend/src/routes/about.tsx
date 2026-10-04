import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useT, type StringKey } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · Cite" },
      {
        name: "description",
        content: "How Cite turns legal text into traceable, deterministic regulatory answers.",
      },
      { property: "og:title", content: "About · Cite" },
      {
        property: "og:description",
        content: "AI structures regulation. Code evaluates coverage. Evidence supports every answer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const PILLARS: { title: StringKey; body: StringKey }[] = [
  { title: "about.pillar.ai.title", body: "about.pillar.ai.body" },
  { title: "about.pillar.code.title", body: "about.pillar.code.body" },
  { title: "about.pillar.evidence.title", body: "about.pillar.evidence.body" },
];

const STEPS: { title: StringKey; body: StringKey }[] = [
  { title: "about.step1.title", body: "about.step1.body" },
  { title: "about.step2.title", body: "about.step2.body" },
  { title: "about.step3.title", body: "about.step3.body" },
  { title: "about.step4.title", body: "about.step4.body" },
  { title: "about.step5.title", body: "about.step5.body" },
  { title: "about.step6.title", body: "about.step6.body" },
];

const COMMITMENTS: StringKey[] = [
  "about.commit.cite",
  "about.commit.asOf",
  "about.commit.pending",
  "about.commit.unknown",
  "about.commit.conflict",
  "about.commit.audit",
  "about.commit.noInvent",
  "about.commit.noAdvice",
];

const OPEN_QUESTIONS: { tag: StringKey; body: StringKey }[] = [
  { tag: "about.open.berkeley.tag", body: "about.open.berkeley" },
  { tag: "about.open.njFair.tag", body: "about.open.njFair" },
  { tag: "about.open.laRso.tag", body: "about.open.laRso" },
  { tag: "about.open.caScreening.tag", body: "about.open.caScreening" },
];

function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("about.eyebrow")} title={t("about.title")}>
        {t("about.body")}
      </PageHeader>

      <div className="fade-up flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("about.cta.lookup")}
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          to="/pipeline"
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-sm text-ink transition-colors hover:bg-secondary"
        >
          {t("about.cta.pipeline")}
        </Link>
        <Link
          to="/changes"
          className="inline-flex items-center gap-2 rounded-full border border-border/80 px-4 py-2 text-sm text-ink transition-colors hover:bg-secondary"
        >
          {t("about.cta.changes")}
        </Link>
      </div>

      {/* Thesis — three roles, one chain */}
      <section className="fade-up mt-12" aria-labelledby="about-thesis">
        <div className="border-b border-border/70 pb-3">
          <h2 id="about-thesis" className="font-serif text-2xl tracking-[-0.02em] text-ink">
            {t("about.thesis")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("about.philosophy")}</p>
        </div>
        <div className="mt-5 grid gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/70">
          {PILLARS.map((p) => (
            <div key={p.title} className="sm:px-5 first:sm:pl-0 last:sm:pr-0">
              <h3 className="font-medium text-ink">{t(p.title)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(p.body)}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-primary/80">
          {t("about.chain")}
        </p>
      </section>

      {/* Pipeline — numbered because it is a sequence */}
      <section className="fade-up mt-14" aria-labelledby="about-architecture">
        <div className="border-b border-border/70 pb-3">
          <h2 id="about-architecture" className="font-serif text-2xl tracking-[-0.02em] text-ink">
            {t("about.architecture")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("about.architecture.lede")}</p>
        </div>
        <ol className="mt-2 divide-y divide-border/70">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 py-4">
              <span className="w-8 shrink-0 font-mono text-sm tabular-nums text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-ink">{t(step.title)}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(step.body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Commitments */}
      <section className="fade-up mt-14" aria-labelledby="about-responsible">
        <div className="border-b border-border/70 pb-3">
          <h2 id="about-responsible" className="font-serif text-2xl tracking-[-0.02em] text-ink">
            {t("about.responsible")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("about.responsible.lede")}</p>
        </div>
        <ul className="mt-2 divide-y divide-border/70">
          {COMMITMENTS.map((key) => (
            <li key={key} className="flex gap-3 py-3 text-sm leading-relaxed text-ink/90">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Open legal questions */}
      <section className="fade-up mt-14" aria-labelledby="about-open">
        <div className="border-b border-border/70 pb-3">
          <h2 id="about-open" className="font-serif text-2xl tracking-[-0.02em] text-ink">
            {t("about.openQuestions")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("about.openQuestions.lede")}</p>
        </div>
        <ul className="mt-2 divide-y divide-border/70">
          {OPEN_QUESTIONS.map((q) => (
            <li key={q.tag} className="py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-primary/80">
                {t(q.tag)}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/90">{t(q.body)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Honesty limits */}
      <section className="fade-up mt-14" aria-labelledby="about-limits">
        <div className="border-b border-border/70 pb-3">
          <h2 id="about-limits" className="font-serif text-2xl tracking-[-0.02em] text-ink">
            {t("about.limits")}
          </h2>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("about.limits.body")}</p>
        <p className="mt-6 text-xs text-muted-foreground">{t("about.demoNote")}</p>
      </section>
    </div>
  );
}
