import { createFileRoute } from "@tanstack/react-router";
import { useT, type StringKey } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Cite" },
      { name: "description", content: "How Cite turns legal text into traceable, deterministic regulatory answers." },
      { property: "og:title", content: "About — Cite" },
      { property: "og:description", content: "AI structures regulation. Code evaluates coverage. Evidence supports every answer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

const OPEN_QUESTIONS: StringKey[] = [
  "about.open.berkeley",
  "about.open.njFair",
  "about.open.laRso",
  "about.open.caScreening",
];

function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader title={t("about.title")}>
        {t("about.body")}
      </PageHeader>

      <blockquote className="fade-up surface px-6 py-5">
        <p className="font-serif text-xl italic leading-snug text-ink sm:text-2xl">{t("about.philosophy")}</p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-primary/80">{t("about.chain")}</p>
      </blockquote>

      <h2 className="mt-12 font-serif text-xl text-ink">{t("about.architecture")}</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="surface p-4 transition-shadow duration-300 hover:shadow-dossier">
            <div className="font-mono text-[11px] tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1.5 font-medium text-ink">{t(step.title)}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(step.body)}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 font-serif text-xl text-ink">{t("about.responsible")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("about.responsible.lede")}</p>
      <ul className="mt-4 space-y-2">
        {COMMITMENTS.map((key) => (
          <li key={key} className="flex gap-2.5 text-sm leading-relaxed text-ink/90">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-serif text-xl text-ink">{t("about.openQuestions")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("about.openQuestions.lede")}</p>
      <ul className="mt-4 space-y-3">
        {OPEN_QUESTIONS.map((key) => (
          <li key={key} className="surface px-4 py-3 text-sm leading-relaxed text-ink/90">
            {t(key)}
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="surface p-4">
          <div className="font-medium text-ink">{t("about.stretch")}</div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("about.stretch.body")}</p>
        </div>
        <div className="surface p-4">
          <div className="font-medium text-ink">{t("about.limits")}</div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("about.limits.body")}</p>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">{t("about.demoNote")}</p>
    </div>
  );
}
