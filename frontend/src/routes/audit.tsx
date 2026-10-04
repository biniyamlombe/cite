import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listAudit } from "@/lib/cite/team";
import { downloadText } from "@/lib/cite/export";
import { PageHeader } from "@/components/cite/layout";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Lookup history — Cite" },
      { name: "description", content: "An audit log of every property you looked up, when, and what the result was." },
      { property: "og:title", content: "Lookup history — Cite" },
      { property: "og:description", content: "Audit log of property lookups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { user, ready } = useAuth();
  const q = useQuery({ queryKey: ["audit", user?.id], queryFn: listAudit, enabled: !!user });
  const csv = () =>
    downloadText("cite-audit-log.csv", ["when,user,address_id,as_of,summary", ...(q.data ?? []).map((e) => `${e.created_at},${e.user_email},${e.address_id},${e.as_of},"${JSON.stringify(e.summary).replace(/"/g, '""')}"`)].join("\n"));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Audit log" title="Lookup history">
        Every property you opened while signed in, with the results you saw. Entries can't be edited.
      </PageHeader>
      {ready && !user && <p className="mt-8 text-sm"><Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your lookup history.</p>}
      {q.data && q.data.length > 0 && <button onClick={csv} className="mt-6 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">Export CSV</button>}
      {q.data?.length === 0 && <p className="mt-8 text-sm text-muted-foreground">No lookups recorded yet.</p>}
      {q.data && q.data.length > 0 && (
        <table className="mt-4 w-full overflow-hidden rounded-lg border bg-card text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Property</th><th className="px-3 py-2">As of</th><th className="px-3 py-2">Result</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {q.data.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{e.created_at.slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-2">{e.address_id}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.as_of}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{Object.entries(e.summary).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}</td>
                <td className="px-3 py-2"><Link to="/" search={{ address: e.address_id, as_of: e.as_of }} className="text-primary hover:underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
