import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { createGroup, deleteGroup, listGroups } from "@/lib/cite/ops";

/** Saved portfolio groups (e.g. "NJ buildings"). Selecting one filters the portfolio table. */
export function GroupBar({ allIds, onSelect }: { allIds: string[]; onSelect: (ids: string[] | null) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ["groups", user?.id], queryFn: listGroups, enabled: !!user });
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ids, setIds] = useState("");
  const create = useMutation({
    mutationFn: () => createGroup(name.trim(), ids.split(/[\s,]+/).map((x) => x.trim()).filter((x) => allIds.includes(x))),
    onSuccess: () => { setName(""); setIds(""); qc.invalidateQueries({ queryKey: ["groups"] }); },
  });
  const del = useMutation({ mutationFn: deleteGroup, onSuccess: () => { pick(null, null); qc.invalidateQueries({ queryKey: ["groups"] }); } });
  const pick = (id: string | null, list: string[] | null) => { setActive(id); onSelect(list); };
  if (!user) return null;
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "bg-secondary text-ink" : "text-muted-foreground hover:text-ink"}`;

  return (
    <section className="surface mb-6 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Groups</span>
        <button className={chip(!active)} onClick={() => pick(null, null)}>All</button>
        {groups.data?.map((g) => (
          <span key={g.id} className="inline-flex items-center">
            <button className={chip(active === g.id)} onClick={() => pick(g.id, g.address_ids)}>{g.name} ({g.address_ids.length})</button>
            {active === g.id && <button onClick={() => del.mutate(g.id)} className="ml-1 text-xs text-muted-foreground hover:text-destructive">delete</button>}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New group name" className="rounded-md border bg-background px-3 py-1.5 text-sm" />
        <input value={ids} onChange={(e) => setIds(e.target.value)} placeholder="Property IDs, e.g. A0003 A0004" className="min-w-64 rounded-md border bg-background px-3 py-1.5 text-sm" />
        <button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50">Create group</button>
      </div>
      {create.error && <p className="mt-2 text-xs text-destructive">{(create.error as Error).message}</p>}
    </section>
  );
}
