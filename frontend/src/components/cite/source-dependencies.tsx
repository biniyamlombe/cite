import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getCiteClient } from "@/lib/cite/client";
import type { LookupResponse } from "@/lib/cite/types";
import { useT } from "@/lib/i18n";

/** Compares metadata only. Without a backend source-content hash, this cannot establish a legal change. */
export function SourceDependencies({ snapshot }: { snapshot: LookupResponse }) {
  const t = useT();
  const docs = useQuery({ queryKey: ["corpus-docs"], queryFn: () => getCiteClient().corpusDocs(), retry: 1, staleTime: 60_000 });
  const dependencies = [...new Set(snapshot.results.map((r) => r.rule?.source_doc_id).filter((id): id is string => !!id))].map((id) => {
    const original = snapshot.results.find((r) => r.rule?.source_doc_id === id)?.rule;
    const current = docs.data?.find((doc) => doc.doc_id === id);
    const status: "loading" | "missing" | "url" | "retrieved" | "same" = !docs.data ? "loading" : !current ? "missing" : original?.source_url && current.source_url && original.source_url !== current.source_url ? "url" : original?.retrieved_at && current.retrieved_at && original.retrieved_at !== current.retrieved_at ? "retrieved" : "same";
    return { id, original, current, status };
  });
  if (!dependencies.length) return <p className="text-xs text-muted-foreground">{t("dependencies.none")}</p>;
  const flagged = dependencies.filter((d) => ["missing", "url", "retrieved"].includes(d.status)).length;
  return <section aria-label={t("dependencies.heading")} className="border-t pt-5">
    <h3 className="eyebrow mb-2">{t("dependencies.heading")}</h3>
    <p className="text-xs leading-relaxed text-muted-foreground">{t("dependencies.caveat")}</p>
    {docs.isLoading && <p className="mt-3 text-xs" aria-busy="true">{t("common.loading")}</p>}
    {docs.isError && <p role="alert" className="mt-3 text-xs text-destructive">{t("dependencies.error")} <button type="button" className="underline" onClick={() => docs.refetch()}>{t("lookup.retry")}</button></p>}
    {docs.data && <><p className={`mt-3 text-sm font-medium ${flagged ? "text-amber-800" : "text-ink"}`}>{flagged ? t("dependencies.flagged").replace("{n}", String(flagged)) : t("dependencies.clear")}</p>
      <ul className="mt-3 max-h-64 divide-y overflow-auto border-t">{dependencies.map((d) => <li key={d.id} className="py-2 text-xs"><div className="flex justify-between gap-2"><span className="font-mono text-ink">{d.id}</span><span className={d.status === "same" ? "text-muted-foreground" : "text-amber-800"}>{t(`dependencies.${d.status}`)}</span></div><p className="mt-1 truncate text-muted-foreground" title={d.current?.title ?? d.original?.title}>{d.current?.title ?? d.original?.title ?? "—"}</p>{d.current?.source_url && <a href={d.current.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">{t("dependencies.source")} <ExternalLink className="size-3" /></a>}</li>)}</ul></>}
  </section>;
}