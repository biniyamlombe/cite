import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getCiteClient } from "@/lib/cite/client";
import { PageHeader } from "@/components/cite/layout";
import { ChangeImpactCard } from "@/components/cite/changes";
import type { TestId } from "@/lib/cite/types";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "Change Radar — Cite" },
      { name: "description", content: "Which regulatory changes affect which properties, and when." },
      { property: "og:title", content: "Change Radar — Cite" },
      { property: "og:description", content: "What will change, when, and which properties will be affected." },
    ],
  }),
  component: ChangesPage,
});

const ORDER: TestId[] = ["T1", "T2", "T3", "T4", "T5"];

function ChangesLoading() {
  const t = useT();
  return (
    <div className="space-y-5 fade-up" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {t("changes.loading")}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="surface overflow-hidden p-5 sm:p-6">
          <div className="skeleton-shimmer h-3 w-28 rounded-sm" />
          <div className="skeleton-shimmer mt-3 h-7 w-2/3 max-w-md rounded-sm" />
          <div className="skeleton-shimmer mt-2 h-4 w-full max-w-xl rounded-sm" />
          <div className="skeleton-shimmer mt-5 h-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function ScenarioStrip({
  tests,
  results,
}: {
  tests: { test_id: TestId }[];
  results: Record<string, { affected_address_ids: string[]; conflict_flag_address_ids?: string[] }>;
}) {
  return (
    <div className="fade-up mb-8 grid gap-2 sm:grid-cols-5">
      {ORDER.map((id) => {
        const present = tests.some((t) => t.test_id === id);
        const n = results[id]?.affected_address_ids.length ?? 0;
        const conflicts = results[id]?.conflict_flag_address_ids?.length ?? 0;
        return (
          <a
            key={id}
            href={`#${id}`}
            className={`rounded-md border px-3 py-2.5 transition-colors hover:border-ring/50 ${
              present ? "bg-card" : "opacity-50"
            }`}
          >
            <div className="font-mono text-xs text-primary">{id}</div>
            <div className="mt-1 font-mono text-lg tabular-nums text-ink">{present ? n : "—"}</div>
            <div className="eyebrow mt-0.5">
              {conflicts > 0 ? `${conflicts} conflict` : "affected"}
            </div>
          </a>
        );
      })}
    </div>
  );
}

function ChangesPage() {
  const t = useT();
  const client = getCiteClient();
  const changes = useQuery({ queryKey: ["changes"], queryFn: () => client.changes() });
  const addrs = useQuery({ queryKey: ["addresses", "", 500], queryFn: () => client.addresses("", 500) });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("changes.eyebrow")} title={t("changes.title")}>
        {t("changes.lede")}
      </PageHeader>

      {changes.isPending && <ChangesLoading />}

      {changes.isError && (
        <div className="surface fade-up p-5 text-sm">
          {t("changes.error")} {(changes.error as Error).message}
        </div>
      )}

      {changes.data && (
        <>
          <ScenarioStrip tests={changes.data.tests} results={changes.data.results} />
          <div className="space-y-5">
            {ORDER.map((id) => {
              const test = changes.data.tests.find((x) => x.test_id === id);
              if (!test) return null;
              return (
                <div key={id} id={id} className="scroll-mt-24">
                  <ChangeImpactCard
                    test={test}
                    result={changes.data.results[id]}
                    addresses={addrs.data ?? []}
                  />
                </div>
              );
            })}

            <article id="T6" className="scroll-mt-24 rounded-lg border border-dashed p-5 opacity-80 sm:p-6">
              <div className="eyebrow flex items-center gap-1.5">
                <Clock className="size-3" /> T6 · Upcoming
              </div>
              <h3 className="mt-1.5 font-serif text-xl text-ink">{t("changes.t6Title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("changes.t6Body")}</p>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
