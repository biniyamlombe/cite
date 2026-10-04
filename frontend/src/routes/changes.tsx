import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangesPage,
});

const ORDER: TestId[] = ["T1", "T2", "T3", "T4", "T5"];

const PUNCH_KEYS: Record<TestId, "changes.punch.T1" | "changes.punch.T2" | "changes.punch.T3" | "changes.punch.T4" | "changes.punch.T5"> = {
  T1: "changes.punch.T1",
  T2: "changes.punch.T2",
  T3: "changes.punch.T3",
  T4: "changes.punch.T4",
  T5: "changes.punch.T5",
};

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
  activeId,
}: {
  tests: { test_id: TestId }[];
  results: Record<string, { affected_address_ids: string[]; conflict_flag_address_ids?: string[] }>;
  activeId?: string | undefined;
}) {
  const t = useT();
  return (
    <nav aria-label={t("changes.title")} className="fade-up mb-8 grid gap-2 sm:grid-cols-5">
      {ORDER.map((id) => {
        const present = tests.some((x) => x.test_id === id);
        const n = results[id]?.affected_address_ids.length ?? 0;
        const conflicts = results[id]?.conflict_flag_address_ids?.length ?? 0;
        const active = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={active ? "true" : undefined}
            className={`touch-manipulation rounded-xl border px-3.5 py-3 transition-[transform,border-color,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-dossier ${
              present ? "bg-card/95" : "opacity-45"
            } ${active ? "border-primary/40 bg-accent/50 shadow-dossier" : "border-border/80"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span translate="no" className="font-mono text-xs font-semibold text-primary">{id}</span>
              <span className="font-mono text-lg tabular-nums text-ink">{present ? n : "—"}</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t(PUNCH_KEYS[id])}</div>
            {conflicts > 0 && (
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-conflict">
                {conflicts} {t("status.conflict").toLowerCase()}
              </div>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function ChangesPage() {
  const t = useT();
  const client = getCiteClient();
  const changes = useQuery({ queryKey: ["changes"], queryFn: () => client.changes() });
  const addrs = useQuery({ queryKey: ["addresses", "", 500], queryFn: () => client.addresses("", 500) });
  const [activeId, setActiveId] = useState<string | undefined>(
    typeof window !== "undefined" ? window.location.hash.replace("#", "") || undefined : undefined,
  );

  useEffect(() => {
    const sync = () => setActiveId(window.location.hash.replace("#", "") || undefined);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("changes.eyebrow")} title={t("changes.title")}>
        {t("changes.lede")}
      </PageHeader>

      {changes.isPending && <ChangesLoading />}

      {changes.isError && (
        <div className="surface fade-up flex gap-3 p-5">
          <AlertCircle className="size-5 shrink-0 text-destructive" />
          <div>
            <div className="font-medium text-ink">{t("changes.error")}</div>
            <p className="mt-1 text-sm text-muted-foreground">{(changes.error as Error).message}</p>
            <button
              type="button"
              onClick={() => changes.refetch()}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              {t("lookup.retry")}
            </button>
          </div>
        </div>
      )}

      {changes.data && (
        <>
          <ScenarioStrip tests={changes.data.tests} results={changes.data.results} activeId={activeId} />
          <div className="space-y-5">
            {ORDER.map((id) => {
              const test = changes.data.tests.find((x) => x.test_id === id);
              if (!test) return null;
              const highlighted = activeId === id;
              return (
                <div
                  key={id}
                  id={id}
                  className={`scroll-mt-24 rounded-lg transition-[box-shadow,background-color] ${
                    highlighted ? "ring-2 ring-ring/40 ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  <ChangeImpactCard
                    test={test}
                    result={changes.data.results[id]}
                    addresses={addrs.data ?? []}
                  />
                </div>
              );
            })}

            <article id="T6" className="scroll-mt-24 surface border-dashed p-5 opacity-90 sm:p-6">
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <Clock className="size-3" /> T6
              </div>
              <h3 className="mt-2 font-serif text-xl text-ink">{t("changes.t6Title")}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {changes.data.results["T6"]?.notes || t("changes.t6Body")}
              </p>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
