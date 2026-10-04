import { CircleHelp, FileWarning, GitMerge, Scale } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Split backend explanations that append pack §9 "Open question:" notes. */
export function splitOpenQuestion(text: string): { body: string; openQuestion: string | null } {
  const marker = "Open question:";
  const idx = text.indexOf(marker);
  if (idx < 0) return { body: text, openQuestion: null };
  return {
    body: text.slice(0, idx).trim(),
    openQuestion: text.slice(idx).trim(),
  };
}

/** True when live applicability rests on an uncaptured / scenario-only primary source. */
export function isLinkOnlyScaffold(rule: {
  conflict_note?: string | null | undefined;
  citation?: string | null | undefined;
  extraction_method?: string | null | undefined;
  evidence_status?: string | null | undefined;
}): boolean {
  const method = rule.extraction_method ?? "";
  // Captured municipal PDFs may still mention pack ecode360 link-only URLs in conflict_note —
  // those are disclosures, not evidence that the rule itself is a scaffold.
  if (method === "municipal_ordinance") return false;
  if (method === "soft_gap_scaffold") return false;
  if (method === "link_only_scaffold" || method === "secondary_report") return true;
  if (rule.evidence_status === "scenario_only") return true;
  const blob = `${rule.conflict_note ?? ""} ${rule.citation ?? ""}`.toLowerCase();
  return blob.includes("link-only") || blob.includes("link only");
}

/** Thin FAQ/summary page used as a disclosed soft-gap screening extract (not full ordinance). */
export function isSoftGapScaffold(rule: {
  extraction_method?: string | null | undefined;
  alias_id?: string | null | undefined;
}): boolean {
  if (rule.extraction_method === "soft_gap_scaffold") return true;
  return rule.alias_id === "CAM-FH-01" || rule.alias_id === "SF-FC-01";
}

export function UnknownFactWarning({
  explanation,
  compact,
}: {
  explanation: string;
  compact?: boolean | undefined;
}) {
  const t = useT();
  const { body, openQuestion } = splitOpenQuestion(explanation);
  return (
    <div className="space-y-2">
      <div className="flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-unknown" />
        <div>
          {!compact && <div className="font-medium text-ink">{t("rule.unable")}</div>}
          <p className="text-foreground/80">{body}</p>
        </div>
      </div>
      {openQuestion && <OpenQuestionWarning note={openQuestion} compact />}
    </div>
  );
}

export function ConflictWarning({ note }: { note?: string | null | undefined }) {
  const t = useT();
  return (
    <div className="flex gap-2.5 rounded-md border border-conflict/25 bg-conflict-soft px-3 py-2.5 text-sm">
      <GitMerge className="mt-0.5 size-4 shrink-0 text-conflict" />
      <div>
        <div className="font-medium text-ink">{t("rule.conflict")}</div>
        {note && <p className="text-foreground/80">{note}</p>}
      </div>
    </div>
  );
}

export function OpenQuestionWarning({
  note,
  compact,
}: {
  note: string;
  compact?: boolean | undefined;
}) {
  const t = useT();
  const body = note.replace(/^Open question:\s*/i, "").trim();
  return (
    <div className="flex gap-2.5 rounded-md border border-primary/20 bg-secondary/60 px-3 py-2.5 text-sm">
      <Scale className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        {!compact && <div className="font-medium text-ink">{t("rule.openQuestion")}</div>}
        <p className="text-foreground/80">{compact ? note : body}</p>
      </div>
    </div>
  );
}

/** Honest handling of pack link-only pages — never invent municipal ordinance text. */
export function LinkOnlyWarning({
  note,
  compact,
}: {
  note?: string | null | undefined;
  compact?: boolean | undefined;
}) {
  const t = useT();
  return (
    <div className="flex gap-2.5 rounded-md border border-unknown/30 bg-unknown-soft px-3 py-2.5 text-sm">
      <FileWarning className="mt-0.5 size-4 shrink-0 text-unknown" />
      <div>
        <div className="font-medium text-ink">{t("rule.linkOnly")}</div>
        <p className="text-foreground/80">
          {compact ? t("rule.linkOnly.short") : t("rule.linkOnly.body")}
        </p>
        {note && !compact ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Soft-gap FAQ/summary extracts — disclosed provisional screening rules, not full code. */
export function SoftGapWarning({
  note,
  compact,
}: {
  note?: string | null | undefined;
  compact?: boolean | undefined;
}) {
  const t = useT();
  return (
    <div className="flex gap-2.5 rounded-md border border-pending/30 bg-pending-soft px-3 py-2.5 text-sm">
      <CircleHelp className="mt-0.5 size-4 shrink-0 text-pending" />
      <div>
        <div className="font-medium text-ink">{t("rule.softGap")}</div>
        <p className="text-foreground/80">
          {compact ? t("rule.softGap.short") : t("rule.softGap.body")}
        </p>
        {note && !compact ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

/** City has uncaptured pack pages and no city-level rules — prefer unknown over inventing. */
export function CorpusGapWarning({ gaps }: { gaps: string[] }) {
  const t = useT();
  if (!gaps.length) return null;
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-md border border-unknown/30 bg-unknown-soft px-3 py-2.5 text-sm"
    >
      <FileWarning aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-unknown" />
      <div>
        <div className="font-medium text-ink">{t("lookup.honesty.corpusGap.title")}</div>
        <p className="text-foreground/80">{t("lookup.honesty.corpusGap")}</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {gaps.map((g) => (
            <li key={g.slice(0, 80)}>{g}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
