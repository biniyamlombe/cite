"use client";

import { useEffect, useState, useTransition } from "react";
import {
  lookupAddress,
  searchAddresses,
  type AddressRow,
  type LookupResponse,
} from "@/lib/api";
import { useLocale } from "@/components/LocaleProvider";
import {
  categoryLabel,
  levelLabel,
  plainExplanationEs,
  resultLabel,
} from "@/lib/i18n";
import { DEFAULT_AS_OF } from "@rhl/shared";

const RESULT_ORDER = [
  "applies",
  "unknown",
  "superseded",
  "not_yet_effective",
  "pending",
] as const;

export default function LookupPage() {
  const { locale, t } = useLocale();
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
    const timer = setTimeout(() => {
      searchAddresses(q)
        .then((r) => setSuggestions(r.addresses))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(timer);
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
      <h1>{t.lookupTitle}</h1>
      <p className="lede">{t.lookupLede}</p>

      <div className="controls">
        <input
          type="search"
          placeholder={t.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t.searchAria}
        />
        <input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          aria-label={t.asOfAria}
        />
        <button
          type="button"
          disabled={pending || !q.trim()}
          onClick={() => runLookup(q.trim().toUpperCase())}
        >
          {pending ? t.lookingUp : t.lookUp}
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
          <h2>{data.address.street_address}</h2>
          <div className="meta-row">
            <div className="stack">
              {data.jurisdiction.state} › {data.jurisdiction.county || "County"} ›{" "}
              {data.jurisdiction.city}
            </div>
            <div>
              {t.asOf} <strong>{data.as_of}</strong>
            </div>
            <div>
              {t.built} {data.address.year_built || "—"} · {t.units}{" "}
              {data.address.units || "—"}
            </div>
            <div className="mono">{data.address.address_id}</div>
          </div>

          {grouped.length === 0 && <p className="muted">{t.noRules}</p>}

          {grouped.map((group) => (
            <div key={group.result}>
              {group.items.map((item) => {
                const title = item.rule?.title || item.team_rule_id;
                const explanation =
                  locale === "es"
                    ? plainExplanationEs({
                        result: item.result,
                        title,
                        asOf: data.as_of,
                        explanationEn: item.explanation,
                        effectiveDate: item.rule?.effective_date,
                      })
                    : item.explanation;

                return (
                  <article key={item.team_rule_id} className="rule-block">
                    <div className="rule-meta">
                      <span className={`badge ${item.result}`}>
                        {resultLabel(item.result, locale)}
                      </span>
                      {item.rule?.category && (
                        <span className="badge">
                          {categoryLabel(item.rule.category, locale)}
                        </span>
                      )}
                      {item.rule?.level && (
                        <span className="badge">
                          {levelLabel(item.rule.level, locale)}
                        </span>
                      )}
                    </div>
                    <h3>{title}</h3>
                    <p>{explanation}</p>
                    {locale === "es" && item.rule?.requirement && (
                      <p className="muted">
                        <span className="label-en">{t.originalEn}: </span>
                        {item.rule.requirement}
                      </p>
                    )}
                    {locale === "en" && item.rule?.requirement && (
                      <p className="muted">{item.rule.requirement}</p>
                    )}
                    {item.conflict_flag && (
                      <p className="flag">{t.conflictFlag}</p>
                    )}
                    {item.rule?.confidence != null &&
                      item.rule.confidence < 0.8 && (
                        <p className="flag">
                          {t.lowConfidence(item.rule.confidence)}
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
                            ? ` · ${t.retrieved} ${item.rule.retrieved_at}`
                            : ""}
                          {item.rule.confidence != null
                            ? ` · ${t.confidence} ${item.rule.confidence}`
                            : ""}
                        </p>
                        {item.rule.source_url && (
                          <p className="muted">
                            <a
                              href={item.rule.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t.source}
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
