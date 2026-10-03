"use client";

import { useEffect, useState } from "react";
import {
  extractDoc,
  fetchAudit,
  type AuditEvent,
} from "@/lib/api";
import { useLocale } from "@/components/LocaleProvider";

export default function PipelinePage() {
  const { t } = useLocale();
  const [docId, setDocId] = useState("D001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [result, setResult] = useState<{
    doc_id: string;
    source: string;
    retrieved_at?: string | null;
    count: number;
    rules: Array<{
      team_rule_id: string;
      title: string;
      category: string;
      citation: string;
      quoted_span: string;
      status: string;
      retrieved_at?: string | null;
    }>;
  } | null>(null);

  async function refreshAudit() {
    try {
      const data = await fetchAudit(15);
      setAudit(data.events);
    } catch {
      setAudit([]);
    }
  }

  useEffect(() => {
    void refreshAudit();
  }, []);

  async function onExtract() {
    setLoading(true);
    setError(null);
    try {
      const data = await extractDoc(docId.trim().toUpperCase());
      setResult(data as typeof result);
      await refreshAudit();
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>{t.pipelineTitle}</h1>
      <p className="lede">
        {t.pipelineLede} Uses Anthropic Claude when{" "}
        <span className="mono">ANTHROPIC_API_KEY</span> is set; otherwise an
        automated heuristic pass over the same text.
      </p>

      <div className="controls">
        <input
          type="text"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          placeholder="Doc ID (e.g. D001)"
          aria-label="Document ID"
        />
        <button type="button" onClick={onExtract} disabled={loading}>
          {loading ? "Extracting…" : "Extract rules"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="section">
          <p>
            <strong>{result.doc_id}</strong> · source={" "}
            <span className="mono">{result.source}</span>
            {result.retrieved_at ? (
              <>
                {" "}
                · retrieved <span className="mono">{result.retrieved_at}</span>
              </>
            ) : null}{" "}
            · {result.count} rule(s)
          </p>
          {result.rules.map((rule) => (
            <article key={rule.team_rule_id} className="rule-block">
              <div className="rule-meta">
                <span className="badge">{rule.status}</span>
                <span className="badge">{rule.category}</span>
              </div>
              <h3>{rule.title}</h3>
              <p>
                <strong>{rule.citation}</strong>
                {rule.retrieved_at
                  ? ` · retrieved ${rule.retrieved_at}`
                  : ""}
              </p>
              <blockquote className="quote">“{rule.quoted_span}”</blockquote>
            </article>
          ))}
        </section>
      )}

      <section className="section">
        <h2>Audit trail</h2>
        <p className="muted">
          Recent extract / test events from{" "}
          <span className="mono">outputs/audit_log.jsonl</span>. Not legal
          advice.
        </p>
        {audit.length === 0 ? (
          <p className="muted">No audit events yet.</p>
        ) : (
          <ul className="audit-list">
            {audit.map((e, i) => (
              <li key={`${e.ts}-${i}`}>
                <span className="mono">{e.ts}</span> · {e.kind}
                {e.doc_id ? ` · ${e.doc_id}` : ""}
                {e.source ? ` · ${e.source}` : ""}
                {e.rule_count != null ? ` · ${e.rule_count} rules` : ""}
                {e.message ? ` — ${e.message}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
