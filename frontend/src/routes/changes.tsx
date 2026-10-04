import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { getCiteClient } from "@/lib/cite/client";
import { ChangeImpactCard } from "@/components/cite/changes";
import type { TestId } from "@/lib/cite/types";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "Change Radar · Cite" },
      {
        name: "description",
        content: "Which regulatory changes affect which properties, and when.",
      },
      { property: "og:title", content: "Change Radar · Cite" },
      {
        property: "og:description",
        content: "What will change, when, and which properties will be affected.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangesPage,
});

const ORDER: TestId[] = ["T1", "T2", "T3", "T4", "T5"];

const PUNCH_KEYS: Record<
  TestId,
  | "changes.punch.T1"
  | "changes.punch.T2"
  | "changes.punch.T3"
  | "changes.punch.T4"
  | "changes.punch.T5"
> = {
  T1: "changes.punch.T1",
  T2: "changes.punch.T2",
  T3: "changes.punch.T3",
  T4: "changes.punch.T4",
  T5: "changes.punch.T5",
};

function ChangesLoading() {
  const t = useT();
  return (
    <div className="space-y-6 fade-up" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {t("changes.loading")}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {ORDER.map((id) => (
          <div key={id} className="rounded-md border border-border/80 px-3 py-3">
            <div className="skeleton-shimmer h-3 w-8 rounded-sm" />
            <div className="skeleton-shimmer mt-3 h-6 w-10 rounded-sm" />
            <div className="skeleton-shimmer mt-2 h-3 w-full rounded-sm" />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="border-b border-border/70 pb-8">
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
    <nav aria-label={t("changes.jump")} className="fade-up mb-12">
      <div className="grid gap-4 sm:grid-cols-5">
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
              className={`group relative overflow-hidden rounded-xl border bg-card p-5 text-left transition-all duration-300 ${
                present ? "" : "opacity-60 hover:opacity-100"
              } ${
                active
                  ? "border-primary shadow-sm ring-4 ring-primary/10"
                  : "border-border/80 hover:border-ink/25 hover:shadow-md"
              }`}
            >
              <div className="mb-6 flex items-start justify-between">
                <span
                  translate="no"
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                    active
                      ? "bg-accent text-primary"
                      : "bg-secondary text-muted-foreground group-hover:bg-secondary/70"
                  }`}
                >
                  {id}
                </span>
                <span
                  className={`font-serif text-3xl leading-none transition-colors ${
                    active ? "text-ink" : "text-muted-foreground/70 group-hover:text-ink"
                  }`}
                >
                  {present ? n : "—"}
                </span>
              </div>
              <p
                className={`text-xs font-medium leading-relaxed transition-colors ${
                  active ? "text-ink" : "text-muted-foreground group-hover:text-ink"
                }`}
              >
                {t(PUNCH_KEYS[id])}
              </p>
              {conflicts > 0 && (
                <span className="mt-2 inline-block text-[9px] font-bold uppercase tracking-tighter text-conflict">
                  {conflicts}
                  {" · "}
                  {t("status.conflict")}
                </span>
              )}
              {active && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-primary" aria-hidden="true" />
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function ChangesPage() {
  const t = useT();
  const client = getCiteClient();
  const changes = useQuery({ queryKey: ["changes"], queryFn: () => client.changes() });
  const addrs = useQuery({
    queryKey: ["addresses", "", 500],
    queryFn: () => client.addresses("", 500),
  });
  const [activeId, setActiveId] = useState<string | undefined>(
    typeof window !== "undefined" ? window.location.hash.replace("#", "") || undefined : undefined,
  );

  useEffect(() => {
    const sync = () => setActiveId(window.location.hash.replace("#", "") || undefined);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const summary = useMemo(() => {
    if (!changes.data) return null;
    let affected = 0;
    let conflicts = 0;
    let present = 0;
    for (const id of ORDER) {
      const r = changes.data.results[id];
      if (!changes.data.tests.some((x) => x.test_id === id)) continue;
      present += 1;
      affected += r?.affected_address_ids.length ?? 0;
      conflicts += r?.conflict_flag_address_ids?.length ?? 0;
    }
    return { present, affected, conflicts };
  }, [changes.data]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="fade-up mb-12 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {t("changes.eyebrow")}
          </span>
          <div className="h-px w-8 bg-primary/20" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="font-serif text-5xl italic leading-tight tracking-tight text-ink sm:text-6xl">
              {t("changes.title")}
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">{t("changes.lede")}</p>
          </div>
          {summary && (
            <div className="flex gap-6 border-b border-border/70 pb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>
                <span className="text-ink">{summary.present}</span> {t("changes.statScenarios")}
              </span>
              <span>
                <span className="text-ink">{summary.affected}</span> {t("changes.statAffected")}
              </span>
              <span>
                <span className="text-primary">{summary.conflicts}</span> {t("changes.statReview")}
              </span>
            </div>
          )}
        </div>
      </header>

      {changes.isPending && <ChangesLoading />}

      {changes.isError && (
        <div className="fade-up flex gap-3 border border-border/80 px-4 py-5">
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

      {changes.data && summary && (
        <>
          <ScenarioStrip
            tests={changes.data.tests}
            results={changes.data.results}
            activeId={activeId}
          />

          <div className="space-y-12">
            {ORDER.map((id) => {
              const test = changes.data.tests.find((x) => x.test_id === id);
              if (!test) return null;
              const highlighted = activeId === id;
              return (
                <div
                  key={id}
                  id={id}
                  className={`scroll-mt-28 fade-up ${
                    highlighted
                      ? "rounded-md ring-1 ring-primary/25 ring-offset-4 ring-offset-background"
                      : ""
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
          </div>
        </>
      )}
    </div>
  );
}
