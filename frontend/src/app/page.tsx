"use client";

import { useEffect, useState, useTransition } from "react";
import {
  lookupAddress,
  searchAddresses,
  type AddressRow,
  type LookupResponse,
} from "@/lib/api";
import { CATEGORY_LABELS, DEFAULT_AS_OF } from "@rhl/shared";

const RESULT_ORDER = [
  "applies",
  "unknown",
  "superseded",
  "not_yet_effective",
  "pending",
] as const;

export default function LookupPage() {
  const [q, setQ] = useState("");
  const [asOf, setAsOf] = useState(DEFAULT_AS_OF);
  const [suggestions, setSuggestions] = useState<AddressRow[]>([]);
  const [data, setData] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      searchAddresses(q)
        .then((r) => setSuggestions(r.addresses))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function runLookup(addressId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await lookupAddress(addressId, asOf);
        setData(result);
        setSuggestions([]);
        setQ(addressId);
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const grouped = RESULT_ORDER.map((result) => ({
    result,
    items: (data?.results || []).filter((r) => r.result === result),
  })).filter((g) => g.items.length > 0);

  return (
    <main>
      <h1>Which rules apply here?</h1>
      <p className="lede">
        Search a sample multifamily address, set an as-of date, and see
        jurisdiction-aware rules with exact corpus citations.
      </p>

      <div className="controls">
        <input
          type="search"
          placeholder="Address ID or street (e.g. A0001 or Delongpre)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search addresses"
        />
        <input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          aria-label="As of date"
        />
        <button
          type="button"
          disabled={pending || !q.trim()}
          onClick={() => runLookup(q.trim().toUpperCase())}
        >
          {pending ? "Looking up…" : "Look up"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="suggest">
          {suggestions.map((a) => (
            <li key={a.address_id}>
              <button type="button" onClick={() => runLookup(a.address_id)}>
                <strong className="mono">{a.address_id}</strong> —{" "}
                {a.street_address}, {a.postal_city}, {a.state}
                {a.legal_city && a.legal_city !== a.postal_city
                  ? ` → ${a.legal_city}`
                  : ""}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error">{error}</p>}

      {data && (
        <section className="section">
          <h2>
            {data.address.street_address}
          </h2>
          <div className="meta-row">
            <div className="stack">
              {data.jurisdiction.state} › {data.jurisdiction.county || "County"} ›{" "}
              {data.jurisdiction.city}
            </div>
            <div>
              As of <strong>{data.as_of}</strong>
            </div>
            <div>
              Built {data.address.year_built || "—"} · Units{" "}
              {data.address.units || "—"}
            </div>
            <div className="mono">{data.address.address_id}</div>
          </div>

          {grouped.length === 0 && (
            <p className="muted">No matching rules for this address/date.</p>
          )}

          {grouped.map((group) => (
            <div key={group.result}>
              {group.items.map((item) => {
                const cat = item.rule?.category as keyof typeof CATEGORY_LABELS | undefined;
                return (
                  <article key={item.team_rule_id} className="rule-block">
                    <div className="rule-meta">
                      <span className={`badge ${item.result}`}>
                        {item.result.replaceAll("_", " ")}
                      </span>
                      {cat && (
                        <span className="badge">
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                      )}
                      {item.rule?.level && (
                        <span className="badge">{item.rule.level}</span>
                      )}
                    </div>
                    <h3>{item.rule?.title || item.team_rule_id}</h3>
                    <p>{item.explanation}</p>
                    {item.rule?.requirement && (
                      <p className="muted">{item.rule.requirement}</p>
                    )}
                    {item.conflict_flag && (
                      <p className="flag">
                        Conflict / human review flagged for this answer.
                      </p>
                    )}
                    {item.rule?.confidence != null &&
                      item.rule.confidence < 0.8 && (
                        <p className="flag">
                          Low confidence ({item.rule.confidence}) — review before relying on this rule.
                        </p>
                      )}
                    {item.rule && (
                      <>
                        <p>
                          <strong>{item.rule.citation}</strong>
                          {item.rule.source_doc_id
                            ? ` · ${item.rule.source_doc_id}`
                            : ""}
                          {item.rule.retrieved_at
                            ? ` · retrieved ${item.rule.retrieved_at}`
                            : ""}
                          {item.rule.confidence != null
                            ? ` · confidence ${item.rule.confidence}`
                            : ""}
                        </p>
                        {item.rule.source_url && (
                          <p className="muted">
                            <a
                              href={item.rule.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Source
                            </a>
                          </p>
                        )}
                        <blockquote className="quote">
                          “{item.rule.quoted_span}”
                        </blockquote>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
