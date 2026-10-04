import type { ReactNode } from "react";
import { AlertCircle, FileSearch, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RetryButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn("rounded-full", className)}
    >
      {label}
    </Button>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = FileSearch,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <div className="font-medium text-ink">{title}</div>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="surface fade-up flex gap-3 p-5" role="alert">
      <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div>
        <div className="font-medium text-ink">{title}</div>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {onRetry && retryLabel ? (
          <RetryButton onClick={onRetry} label={retryLabel} className="mt-3" />
        ) : null}
      </div>
    </div>
  );
}

export function LoadingSkeleton({
  title,
  hint,
  stages,
}: {
  title: string;
  hint?: string;
  stages?: string[];
}) {
  return (
    <div className="space-y-6 fade-up" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        <div>
          <div className="font-medium text-ink">{title}</div>
          {hint ? <p className="text-xs">{hint}</p> : null}
        </div>
      </div>
      {stages && stages.length > 0 ? (
        <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {stages.map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-full border px-2.5 py-1",
                i === 0 ? "border-primary/40 bg-primary/5 text-ink" : "border-border",
              )}
            >
              {s}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="surface overflow-hidden p-5 sm:p-6">
        <div className="skeleton-shimmer h-3 w-24 rounded-sm" />
        <div className="skeleton-shimmer mt-3 h-8 w-2/3 max-w-md rounded-sm" />
        <div className="skeleton-shimmer mt-2 h-4 w-1/2 max-w-sm rounded-sm" />
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="skeleton-shimmer h-14 rounded-md" />
          <div className="skeleton-shimmer h-14 rounded-md" />
          <div className="skeleton-shimmer h-14 rounded-md" />
        </div>
      </div>
      <div className="grid gap-3">
        <div className="skeleton-shimmer h-36 rounded-lg" />
        <div className="skeleton-shimmer h-36 rounded-lg" />
      </div>
    </div>
  );
}
