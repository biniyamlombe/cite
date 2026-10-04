import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { deleteMemo, listMemos } from "@/lib/cite/team";
import { downloadText, lookupToCsv } from "@/lib/cite/export";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/cite/layout";
import { SignInCard } from "@/components/cite/sign-in-card";

export const Route = createFileRoute("/memos")({
  head: () => ({
    meta: [
      { title: "Saved memos · Cite" },
      {
        name: "description",
        content: "Your saved regulatory applicability memos, kept for audit.",
      },
      { property: "og:title", content: "Saved memos · Cite" },
      { property: "og:description", content: "Saved applicability memos for audit trails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemosPage,
});

function MemosPage() {
  const t = useT();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["memos", user?.id], queryFn: listMemos, enabled: !!user });
  const del = useMutation({
    mutationFn: deleteMemo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memos"] }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow={t("memos.eyebrow")} title={t("memos.title")}>
        {t("memos.lede")}{" "}
        <Link to="/audit" className="text-primary hover:underline">
          {t("memos.history")}
        </Link>
      </PageHeader>

      {ready && !user && <SignInCard messageKey="memos.signin" />}

      {user && q.isLoading && (
        <p className="mt-8 text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      {q.error && <p className="mt-8 text-sm text-destructive">{(q.error as Error).message}</p>}

      {user && q.data && q.data.length === 0 && (
        <div className="surface mt-8 flex flex-col items-start gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("memos.empty")}</p>
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/92"
          >
            {t("memos.openLookup")}
          </Link>
        </div>
      )}

      {user && !!q.data?.length && (
        <ul className="surface mt-8 divide-y">
          {q.data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="font-medium text-ink">{m.title}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {t("memos.saved")} {m.created_at.slice(0, 16).replace("T", " ")} ·{" "}
                  {m.snapshot.results?.length ?? 0} {t("rules.count")}
                </div>
                {m.note && <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>}
              </div>
              <div className="flex gap-2">
                <Link
                  to="/"
                  search={{ address: m.address_id, as_of: m.as_of }}
                  className="rounded-full border border-border/80 px-3.5 py-1.5 text-sm hover:bg-secondary"
                >
                  {t("memos.open")}
                </Link>
                <button
                  onClick={() =>
                    downloadText(
                      `cite-memo-${m.address_id}-${m.as_of}.csv`,
                      lookupToCsv(m.snapshot),
                    )
                  }
                  className="rounded-full border border-border/80 px-3.5 py-1.5 text-sm hover:bg-secondary"
                >
                  {t("action.csv")}
                </button>
                <button
                  onClick={() => del.mutate(m.id)}
                  aria-label={t("memos.delete")}
                  className="rounded-full border border-border/80 px-2.5 py-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
