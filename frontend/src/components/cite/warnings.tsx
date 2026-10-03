import { CircleHelp, GitMerge } from "lucide-react";

export function UnknownFactWarning({ explanation, compact }: { explanation: string; compact?: boolean | undefined }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-unknown/25 bg-unknown-soft px-3 py-2.5 text-sm">
      <CircleHelp className="mt-0.5 size-4 shrink-0 text-unknown" />
      <div>
        {!compact && <div className="font-medium text-ink">Unable to determine</div>}
        <p className="text-foreground/80">{explanation}</p>
      </div>
    </div>
  );
}

export function ConflictWarning({ note }: { note?: string | null | undefined }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-conflict/25 bg-conflict-soft px-3 py-2.5 text-sm">
      <GitMerge className="mt-0.5 size-4 shrink-0 text-conflict" />
      <div>
        <div className="font-medium text-ink">State/local conflict — human review required</div>
        {note && <p className="text-foreground/80">{note}</p>}
      </div>
    </div>
  );
}
