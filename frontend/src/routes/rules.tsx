import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getCiteClient } from "@/lib/cite/client";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/cite/labels";
import type { Category, RuleStatus } from "@/lib/cite/types";
import { PageHeader } from "@/components/cite/layout";
import { RuleCard, RuleDetailDrawer, type RuleView } from "@/components/cite/rule";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Rules catalog — Cite" },
      { name: "description", content: "Browse every extracted rental-housing rule with its citation and source text." },
      { property: "og:title", content: "Rules catalog — Cite" },
      { property: "og:description", content: "Every extracted rule, with official citation and quoted source." },
    ],
  }),
  component: RulesPage,
});

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
      <span className="eyebrow">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-ink outline-none">
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function RulesPage() {
  const { data, isPending, isError, error } = useQuery({ queryKey: ["rules"], queryFn: () => getCiteClient().rules() });
  const [jur, setJur] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<RuleView | null>(null);
  const jurisdictions = useMemo(() => [...new Set((data ?? []).map((r) => r.jurisdiction))].sort(), [data]);
  const filtered = (data ?? []).filter((r) => (!jur || r.jurisdiction === jur) && (!cat || r.category === cat) && (!status || r.status === status));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader eyebrow="Module A · Extracted corpus" title="Rules catalog">
        Every rule Cite has extracted, with its official citation and verbatim source text.
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select label="Jurisdiction" value={jur} onChange={setJur} options={jurisdictions.map((j) => [j, j])} />
        <Select label="Category" value={cat} onChange={setCat} options={Object.entries(CATEGORY_LABEL) as [Category, string][]} />
        <Select label="Status" value={status} onChange={setStatus} options={Object.entries(STATUS_LABEL) as [RuleStatus, string][]} />
        <span className="ml-auto font-mono text-xs text-muted-foreground">{filtered.length} rules</span>
      </div>
      {isPending && <div className="grid gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="surface h-28 animate-pulse" />)}</div>}
      {isError && <div className="surface p-5 text-sm">Could not load rules. {(error as Error).message}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((r) => {
          const v: RuleView = { id: r.team_rule_id, rule: r };
          return <RuleCard key={r.team_rule_id} view={v} onOpen={() => setOpen(v)} />;
        })}
      </div>
      {data && filtered.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No rules match these filters.</p>}
      <RuleDetailDrawer view={open} onClose={() => setOpen(null)} />
    </div>
  );
}
