---
name: security-performance-audit
description: >-
  Runs a structured security and performance audit of the codebase and running app,
  then delivers a report-only summary with severities, evidence, and optional fix
  directions (or explicit no-action). Covers dependency audit, lint/build, OWASP-oriented
  code review for Next.js + Supabase, Lighthouse and API timing. Use when the user asks
  for a security audit, vulnerability review, performance benchmark, Lighthouse, Web
  Vitals, efficiency check, load or speed test, or a report-only assessment without
  applying code changes.
---

# Security + performance audit (report-only)

## Non-negotiables

- **Deliverable is the report.** Do not edit the codebase, install packages, or run `npm audit fix` unless the user explicitly asks for fixes or remediation after the audit.
- This is **not** a penetration test or formal certification. Call out limitations in every report.
- Never print or paste real secrets from `.env.local`. Refer to variable **names** only.

## Signal-specific context (tune checks here)

- **Stack:** Next.js App Router (`app/`), Supabase (`lib/supabase.ts`, `supabase/schema.sql`), API routes under `app/api/` (e.g. `stories`, `scrape`, `filter`, `push/subscribe`, `push/unsubscribe`).
- **Data collection:** `lib/scraper/` — user-controlled or remote URLs may imply SSRF / open-redirect class risks; review how URLs are fetched and validated.
- **Docs:** Project conventions and known pitfalls live in `CLAUDE.md` (e.g. lazy env-dependent clients, service role vs anon for feed reads).

## Phase 0 — Scope

1. Confirm **target URL** for runtime checks: user-provided, or default `http://localhost:3000` if they agree the dev or production server is running.
2. Note **branch/commit** if available (e.g. `git rev-parse --short HEAD`) and **Node version** (`node -v`).

## Phase 1 — Supply chain and static tooling

Run from the repo root and capture summarized output (not full dumps unless needed for evidence):

1. **`npm audit`** — summarize by severity; list package names and advisory titles. Optionally **`npm audit --production`** if the user cares about deploy-time deps only.
   - Do **not** run `npm audit fix` unless the user explicitly requests remediation.
2. **`npm run lint`** — errors and material warnings.
3. **`npm run build`** — record **wall-clock duration**, failures, and notable Next.js warnings.

## Phase 2 — Security review (code + architecture)

Use read-only search and file review. Focus areas:

| Area | What to check |
|------|----------------|
| **Secrets & config** | `.env.local` / `.env.local.example` not committed; no logging of tokens; server-only keys (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VAPID_*`) never exposed via `NEXT_PUBLIC_*`; `lib/supabase.ts` and API routes use the right client for the trust boundary. |
| **API routes** | `app/api/**/route.ts`: authentication/authorization if applicable, abuse (cron secrets, unauthenticated expensive work like scrape/filter), input validation, error messages that leak internals. |
| **Supabase** | `supabase/schema.sql`: RLS and policies vs where `getSupabaseAdmin()` is used; align with how the app reads/writes data (server vs client). |
| **Scrapers** | `lib/scraper/*`: fetching arbitrary or feed URLs — SSRF, redirect handling, timeouts, size limits, HTML parsing safety. |
| **Web** | React: `dangerouslySetInnerHTML`, unsanitized URLs in `href`/`src`, any user-controlled markup. |
| **Risky patterns** | Search for `eval(`, `new Function`, child_process, raw SQL string concatenation with user input. |

Assign a **severity** per finding: Critical / High / Medium / Low / Informational.

## Phase 3 — Performance and efficiency

1. **Build** — duration and warnings (from Phase 1) as a coarse signal.
2. **Lighthouse (optional but recommended)** — if a reachable URL exists and the user did not forbid network/tooling installs via `npx`:

   ```bash
   npx lighthouse "<URL>" \
     --only-categories=performance,accessibility,best-practices,seo \
     --output=json \
     --output-path=./lighthouse-report.json \
     --chrome-flags="--headless=new"
   ```

   Summarize: Performance / Accessibility / Best practices / SEO category scores; LCP, FCP, TBT, CLS if present in the JSON; note the report path. If Lighthouse cannot run (no Chrome, CI constraints), state that and skip or suggest the user run locally.

3. **API latency** — with server up, use timing against safe GET endpoints, e.g.:

   ```bash
   curl -s -o /dev/null -w "dns:%{time_namelookup} connect:%{time_connect} ttfb:%{time_starttransfer} total:%{time_total}\n" "http://localhost:3000/api/stories"
   ```

   Do not hammer scrape/filter POST routes without user consent (side effects, cost, external APIs).

4. **Puppeteer MCP (optional)** — only if available and schemas were checked: scripted navigation or screenshots for subjective load/UX. Not a substitute for Lighthouse metrics.

5. **Follow-up ideas (report only)** — e.g. `@next/bundle-analyzer` for bundle size; do not add dependencies unless the user asks.

## Phase 4 — Report template

Produce the final answer using this structure:

### Executive summary

One short paragraph: overall risk posture, build health, and whether performance looks acceptable for the stated target.

### Environment

- Target URL(s), branch/commit, Node version, date of audit.

### Security findings

| Severity | Area | Finding | Evidence (file:line or command snippet) | Suggested direction or “No change needed” |

### Performance

- Build time and notable warnings.
- Lighthouse scores (if run) and key Web Vitals from JSON.
- API timing samples (which URL, cold vs warm if noted).
- Interpretation and **suggested direction** or **“Acceptable as-is”**.

### Dependency health

- `npm audit` summary table or bullet list by severity.

### Limitations

- Static review + point-in-time benchmarks; not exhaustive; no guarantee of exploitability without dedicated security testing.

## Examples

**User:** “Audit the app on localhost, report only.”

**Agent:** Confirm server URL → run Phase 1 commands → Phase 2 file review → Phase 3 Lighthouse + curl to `/api/stories` if GET exists → output full report; no code edits.

**User:** “Security review only, no Lighthouse.”

**Agent:** Phases 0–2 + dependency summary; skip Lighthouse; state omission under Performance.
