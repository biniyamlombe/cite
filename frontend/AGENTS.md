<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Cite UI only displays API results via the CiteApiClient interface (src/lib/cite/client.ts); mocks live in src/mocks and are used unless VITE_API_URL is set. Why: legal logic must stay in the backend.
- Pipeline page (/pipeline) shows extract results via CiteApiClient.extract; validation results come from the backend/mocks, never computed in the UI.
- UI chrome is translated EN/ES through src/lib/i18n.tsx; legal quotes, citations and backend explanations stay in source language.
- Property Lookup keeps address and as-of date in the URL (?address=&as_of=) so views are shareable.
- Watchlist is a per-browser UI preference (localStorage via src/lib/cite/watchlist.ts); portfolio alerts only compare backend lookup results at two dates, never re-evaluate rules.
- CSV export serialises the lookup response as returned (src/lib/cite/export.ts).
- Team data (saved memos, rule comments, email alert subscriptions) lives in Lovable Cloud tables accessed via src/lib/cite/team.ts with row-level rules; memos store the lookup response as returned. Why: shared, auditable, no legal logic in the UI.
- Rule version history comes from CiteApiClient.ruleVersions (GET /rules/:id/versions); the UI only renders a word diff for display.
- Lookup audit log (lookup_audit table) is append-only and stores result counts copied from the lookup response; precedence text comes from the backend field rule.precedence_note, never decided in the UI. Why: audit integrity and no legal logic in the frontend.
- Re-checks, API lookups and webhooks only copy backend lookup results and diff them (src/lib/cite/recheck.server.ts); roles live in user_roles with has_role(). Why: no legal logic in the frontend; no privilege escalation.
- Review cases are owner-scoped snapshots of backend lookup responses; database triggers write immutable case events after edits. Why: reviewers can track decisions without letting frontend code reinterpret legal results or forge audit entries.
- Fact correction requests are owner-readable, append-only for users, and do not update lookup facts; processing and any legal re-evaluation must happen in the backend. Why: intake cannot silently change a determination.
- Case source dependency checks compare saved document metadata with current corpus metadata only, never claim content or legal changes; case packets serialize frozen responses and review events. Why: the API does not expose reliable content-version signals.
