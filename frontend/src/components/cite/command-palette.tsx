import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import { useT, type StringKey } from "@/lib/i18n";

type NavTo =
  | "/"
  | "/changes"
  | "/rules"
  | "/pipeline"
  | "/about"
  | "/portfolio"
  | "/bulk"
  | "/coverage"
  | "/dashboard"
  | "/memos"
  | "/settings";

const DEMO: ReadonlyArray<{ id: string; labelKey: StringKey }> = [
  { id: "A0005", labelKey: "lookup.demo.unknown" },
  { id: "A0065", labelKey: "lookup.demo.remap" },
  { id: "A0002", labelKey: "lookup.demo.conflict" },
  { id: "SA0001", labelKey: "lookup.demo.stretch" },
];

const PRIMARY: ReadonlyArray<{ to: NavTo; key: StringKey }> = [
  { to: "/", key: "nav.lookup" },
  { to: "/changes", key: "nav.changes" },
  { to: "/rules", key: "nav.rules" },
  { to: "/pipeline", key: "nav.pipeline" },
  { to: "/about", key: "nav.about" },
];

const MORE: ReadonlyArray<{ to: NavTo; key: StringKey }> = [
  { to: "/portfolio", key: "nav.portfolio" },
  { to: "/bulk", key: "nav.bulk" },
  { to: "/coverage", key: "nav.coverage" },
  { to: "/dashboard", key: "nav.dashboard" },
  { to: "/memos", key: "nav.memos" },
  { to: "/settings", key: "nav.settings" },
];

export function CommandPalette() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cite:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cite:command", onOpen);
    };
  }, []);

  const go = (to: NavTo, search?: { address: string }) => {
    setOpen(false);
    if (search) void navigate({ to: "/", search });
    else void navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">{t("command.open")}</DialogTitle>
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.empty")}</CommandEmpty>
        <CommandGroup heading={t("command.group.demo")}>
          {DEMO.map((d) => (
            <CommandItem
              key={d.id}
              value={`${d.id} ${t(d.labelKey)}`}
              onSelect={() => go("/", { address: d.id })}
            >
              <span className="font-mono text-xs text-primary">{d.id}</span>
              <span className="text-muted-foreground">{t(d.labelKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.group.nav")}>
          {PRIMARY.map((n) => (
            <CommandItem key={n.to} value={t(n.key)} onSelect={() => go(n.to)}>
              {t(n.key)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.group.more")}>
          {MORE.map((n) => (
            <CommandItem key={n.to} value={t(n.key)} onSelect={() => go(n.to)}>
              {t(n.key)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Header affordance — opens the same palette as ⌘K. */
export function CommandPaletteTrigger() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("cite:command"))}
      aria-label={t("command.open")}
      className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-paper/80 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-ink sm:inline-flex"
    >
      <span>{t("command.openShort")}</span>
      <kbd className="rounded border border-border/70 bg-secondary/80 px-1 py-px text-[10px]">
        {t("command.shortcut")}
      </kbd>
    </button>
  );
}
