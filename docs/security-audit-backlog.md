# Security and performance audit backlog

Generated from the project audit workflow (see `.cursor/skills/security-performance-audit/SKILL.md`). Update this file when re-running audits.

## Environment (last run)

- **Commit:** `5cbd168` (update when re-auditing)
- **Node:** v24.13.1
- **Phase 1 — tooling:** `npm audit` (0 vulnerabilities), `npm run lint` (clean), `npm run build` (success, ~5s compile + static generation)

## Critical / High (resolved or tracked in code)

| Item | Severity | Status / notes |
|------|-----------|----------------|
| Browser could not run `/api/scrape` in production (cron-only `CRON_SECRET`) | High | **Mitigated:** session-authenticated scrape with per-user rate limit (`lib/scrape-auth.ts`, `lib/scrape-rate-limit.ts`); feed uses `POST` with cookies. |
| `hasAnthropicKey` true with undecryptable / orphan credential row | High | **Mitigated:** `/api/settings/status` and `getServerPostAuthDestination` use `getDecryptedAnthropicKey`; `force-dynamic` on status route. |
| Pipeline prefs appeared ineffective | Medium | **Addressed:** UI documents once-per-raw semantics; `POST /api/filter/reset-progress` clears `user_raw_scored` + `scored_stories` for re-score; server logs prefs summary on each filter POST. |

## Phase 2 — ongoing review checklist

- **API routes:** Keep expensive routes (scrape, filter) behind auth or secrets; avoid leaking stack traces in JSON errors.
- **Service role:** `getSupabaseAdmin()` bypasses RLS — ensure every query is scoped by `user.id` from `getSessionUser()` (or cron secret for scrape).
- **Scrapers:** Remote feeds only; watch SSRF if user-supplied URLs are ever added.
- **Client:** No `dangerouslySetInnerHTML` in app sources at last grep; re-check when adding rich text.
- **Dependencies:** Re-run `npm audit` after dependency bumps; do not auto-apply `npm audit fix` without review.

## Phase 3 — optional (not run in last pass)

- Lighthouse against production URL when stable.
- Timed `curl` against `GET /api/stories` (authenticated) for TTFB regression.

## Limitations

Not a penetration test or certification. Config and Supabase dashboard settings (redirect URLs, RLS in deployed DB) must match the repo.
