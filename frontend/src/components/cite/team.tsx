import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { addComment, deleteComment, listComments } from "@/lib/cite/team";
import { getCiteClient } from "@/lib/cite/client";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status";

export function RuleComments({ ruleId }: { ruleId: string }) {
  const t = useT();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({
    queryKey: ["comments", ruleId],
    queryFn: () => listComments(ruleId),
    enabled: !!user,
  });
  const add = useMutation({
    mutationFn: () => addComment(ruleId, body.trim()),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", ruleId] });
    },
  });
  const del = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", ruleId] }),
  });

  return (
    <section>
      <div className="eyebrow mb-2">{t("rule.teamNotes")}</div>
      {ready && !user ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">
            {t("nav.signin")}
          </Link>{" "}
          {t("rule.teamNotes.signin")}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {q.data?.map((c) => (
              <li key={c.id} className="rounded-md border bg-card px-3 py-2">
                <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>
                    {c.author_email} · {c.created_at.slice(0, 10)}
                  </span>
                  {c.user_id === user?.id && (
                    <button onClick={() => del.mutate(c.id)} aria-label={t("rule.deleteNote")}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink">{c.body}</p>
              </li>
            ))}
            {q.data?.length === 0 && (
              <li className="text-sm text-muted-foreground">{t("rule.teamNotes.empty")}</li>
            )}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) add.mutate();
            }}
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder={t("rule.teamNotes.placeholder")}
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
            />
            <button
              disabled={add.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
            >
              {t("rule.teamNotes.add")}
            </button>
          </form>
          {add.error && (
            <p className="mt-1 text-xs text-destructive">{(add.error as Error).message}</p>
          )}
        </>
      )}
    </section>
  );
}

/** Word-level diff for display only: marks words removed/added between two quoted spans. */
function wordDiff(a: string, b: string) {
  const A = a.split(/\s+/),
    B = b.split(/\s+/);
  const dp = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: { t: "=" | "-" | "+"; w: string }[] = [];
  let i = 0,
    j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      out.push({ t: "=", w: A[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ t: "-", w: A[i++]! });
    else out.push({ t: "+", w: B[j++]! });
  }
  while (i < A.length) out.push({ t: "-", w: A[i++]! });
  while (j < B.length) out.push({ t: "+", w: B[j++]! });
  return out;
}

export function RuleVersionHistory({
  ruleId,
  defaultOpen = false,
}: {
  ruleId: string;
  defaultOpen?: boolean | undefined;
}) {
  const t = useT();
  const q = useQuery({
    queryKey: ["versions", ruleId],
    queryFn: () => getCiteClient().ruleVersions(ruleId),
  });
  const v = q.data ?? [];
  const [open, setOpen] = useState(defaultOpen);
  const count = v.length;
  return (
    <section className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <div className="eyebrow">{t("rule.versions")}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count > 0
              ? t(count === 1 ? "rule.versionsCountOne" : "rule.versionsCountMany").replace(
                  "{n}",
                  String(count),
                )
              : t("rule.versionsHint")}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t px-4 py-3">
          {q.isLoading && (
            <p className="text-sm text-muted-foreground">{t("rule.versionsLoading")}</p>
          )}
          {q.isError && (
            <p role="alert">
              {t("rule.versionsError")}{" "}
              <button className="underline" onClick={() => void q.refetch()}>
                {t("lookup.retry")}
              </button>
            </p>
          )}
          {q.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("rule.versionsEmpty")}</p>
          )}
          <ol className="space-y-3">
            {v.map((ver, idx) => {
              const prev = v[idx + 1];
              return (
                <li key={ver.version} className="rounded-md border bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span className="text-ink">{ver.version}</span>
                    <span>
                      {t("rule.versionsRelease")} {ver.corpus_release} · {ver.released_at}
                    </span>
                    <StatusBadge value={ver.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{ver.change_note}</p>
                  <blockquote className="mt-2 font-serif text-sm leading-relaxed">
                    {prev && prev.quoted_span !== ver.quoted_span
                      ? wordDiff(prev.quoted_span, ver.quoted_span).map((p, k) => (
                          <span
                            key={k}
                            className={
                              p.t === "+"
                                ? "bg-applies/15 text-ink"
                                : p.t === "-"
                                  ? "text-muted-foreground line-through"
                                  : ""
                            }
                          >
                            {p.w}{" "}
                          </span>
                        ))
                      : ver.quoted_span}
                  </blockquote>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
