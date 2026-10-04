import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

/** Shared signed-out empty state for Team surfaces under More. */
export function SignInCard({ messageKey }: { messageKey: "dashboard.signin" | "memos.signin" | "settings.signin" }) {
  const t = useT();
  return (
    <div className="surface mt-8 flex flex-col items-start gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{t(messageKey)}</p>
      <Link
        to="/auth"
        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:bg-primary/92 active:scale-[0.98]"
      >
        {t("nav.signin")}
      </Link>
    </div>
  );
}
