"use client";

import { useState } from "react";
import { extractDoc } from "@/lib/api";

export default function PipelinePage() {
  const [docId, setDocId] = useState("D001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function onExtract() {
    setLoading(true);
    setError(null);
    try {
      const data = await extractDoc(docId.trim().toUpperCase());
      setResult(data as typeof result);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Extraction pipeline</h1>
      <p className="lede">
        Live Module A demo: read one capturable corpus document and emit
        validated rule records. Uses Anthropic Claude when{" "}
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
    </main>
  );
}
