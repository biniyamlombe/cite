"use client";

import { useEffect, useState } from "react";
import { fetchChanges } from "@/lib/api";

type ChangesPayload = Awaited<ReturnType<typeof fetchChanges>>;

export default function ChangesPage() {
  const [data, setData] = useState<ChangesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChanges()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  return (
    <main>
      <h1>Law change tracking</h1>
      <p className="lede">
        Deterministic tests T1–T5 from the starter pack: which sample addresses
        each change affects, with as-of before/after where relevant.
      </p>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading change tests…</p>}

      {data && (
        <div className="change-list">
          {data.tests.map((test) => {
            const result = data.results[test.test_id];
            return (
              <article key={test.test_id} className="change-item">
                <div className="rule-meta">
                  <span className="badge">{test.test_id}</span>
                  <span className="badge">{test.type}</span>
                </div>
                <h2 style={{ fontSize: "1.25rem", margin: "0.35rem 0" }}>
                  {test.title}
                </h2>
                <p className="muted">{test.expected_behavior}</p>
                <p>
                  Rules:{" "}
                  <span className="mono">{test.rule_ids.join(", ")}</span>
                </p>
                {test.as_of_before && (
                  <p>
                    Before <span className="mono">{test.as_of_before}</span> →
                    after <span className="mono">{test.as_of_after}</span>
                    {result?.before_status && (
                      <>
                        {" "}
                        ({result.before_status} → {result.after_status})
                      </>
                    )}
                  </p>
                )}
                {result ? (
                  <>
                    <p>
                      <strong>{result.affected_address_ids.length}</strong>{" "}
                      affected addresses
                      {result.conflict_flag_address_ids ? (
                        <>
                          {" "}
                          ·{" "}
                          <strong>
                            {result.conflict_flag_address_ids.length}
                          </strong>{" "}
                          conflict flags
                        </>
                      ) : null}
                    </p>
                    {result.notes && <p className="muted">{result.notes}</p>}
                    {result.affected_address_ids.length > 0 && (
                      <p className="mono muted">
                        {result.affected_address_ids.slice(0, 12).join(", ")}
                        {result.affected_address_ids.length > 12
                          ? ` … +${result.affected_address_ids.length - 12} more`
                          : ""}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    No results yet — run <span className="mono">npm run changes</span>.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
