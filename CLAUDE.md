# Signal — Personal Intelligence Briefing App

## What This Project Is
A personalized web app that scrapes the internet (RSS feeds, Reddit, Hacker News) for AI, crypto, and tech news, filters everything through Claude AI based on a user profile, and surfaces only the high-signal information worth acting on. Built by someone early in their crypto/AI journey who wants to spot opportunities without drowning in noise.

## Tech Stack
- **Frontend/Backend:** Next.js 16 (App Router)
- **Database:** Supabase (Postgres)
- **AI Filtering:** Claude Haiku via Anthropic API (cheapest model, batched calls)
- **Data Sources:** RSS feeds, Reddit API, Hacker News API (all free)
- **Hosting:** Vercel (free tier)
- **Styling:** Tailwind CSS

## Commands
```bash
npm run dev        # Start local development server (localhost:3000)
npm run tunnel     # Public HTTPS URL via Cloudflare quick tunnel (run in a second terminal; needs dev on :3000)
npm run build      # Build for production
npm run lint       # Run ESLint
npx supabase start # Start local Supabase instance (if using local dev)
```

## Project Structure
```
signal/
├── CLAUDE.md                  # This file
├── .claude/
│   ├── agents/                # Sub-agent definitions
│   │   ├── scraper.md         # Handles data collection from all sources
│   │   ├── filter.md          # Handles Claude AI scoring and filtering
│   │   ├── briefing.md        # Handles formatting and delivery
│   │   └── security-performance-audit.md  # Report-only audit workflow
│   └── commands/              # Custom slash commands
│       ├── scrape.md          # /scrape — manually trigger a data collection run
│       ├── brief.md           # /brief — generate a fresh briefing on demand
│       └── audit.md           # /audit — security + performance report
├── app/                       # Next.js App Router pages
│   ├── page.tsx               # Main feed page
│   ├── layout.tsx             # Root layout
│   └── api/
│       ├── scrape/route.ts    # API endpoint: trigger scraper
│       └── brief/route.ts     # API endpoint: generate briefing
├── lib/
│   ├── scraper/               # Data collection modules
│   │   ├── rss.ts             # RSS feed parser
│   │   ├── reddit.ts          # Reddit API client
│   │   └── hn.ts              # Hacker News API client
│   ├── filter.ts              # Claude Haiku filtering logic
│   ├── supabase.ts            # Supabase client
│   └── user-profile.ts        # User profile — what Claude uses to score relevance
├── components/                # React UI components
│   ├── FeedCard.tsx           # Individual story card
│   ├── CategoryFilter.tsx     # Opportunities / Ideas / Intel tabs
│   └── NotificationBell.tsx   # Push notification toggle
└── .env.local                 # API keys (never commit this)
```

## Architecture: How Data Flows
```
[Public `/`] → product copy + Log in / Sign up → `/login` → BYOK in `/settings` → `/feed` (onboarding page optional / later)
[Supabase Auth] → session (cookie) → protected /feed, /settings, /onboarding
       ↓
[Cron: every 4 hours] (scrape only — filter is on-demand per user with BYOK)
       ↓
[Scraper]       → fetches RSS + Reddit + HN → shared raw_stories pool
       ↓
[User: Run Pipeline] → decrypt their Anthropic key → Claude Haiku batches → scored_stories (per user_id)
       ↓
[Web App]       → /api/stories (session) → feed by category
       ↓
[Push Notif]    → user’s subscriptions → high-score opportunities for that user
```
Operator secrets (Supabase service role, `SECRETS_ENCRYPTION_KEY`, scrape keys) stay in deployment env — never embedded for end users. End users configure **their** Anthropic key in Settings (encrypted at rest).

## The User Profile (What Claude Uses to Filter)
Onboarding answers live in `user_profiles.profile` (JSON). `lib/user-profile-prompt.ts` merges them with defaults from `lib/user-profile.ts` for the scoring prompt.

Key profile attributes:
- 3-4 years crypto experience, Ethereum ecosystem focus
- New to software development (1-2 months), building in AI/crypto intersection
- Goal: spot opportunities (arb strategies, early projects, market inefficiencies)
- Goal: find project ideas worth building
- Goal: stay informed enough to contribute to conversations at startups
- Noise sensitivity: HIGH — surface only what's worth acting on

## Cost Controls (IMPORTANT)
- Use `claude-haiku-4-5-20251001` ONLY — never Sonnet or Opus for filtering
- Always batch stories into a single prompt (never one API call per story)
- Pre-filter by keyword BEFORE sending to Claude (halves token usage)
- Target: < $3/month in API costs
- Log token usage on every Claude API call to `api_usage` table

## Constraints — Never Do These
- Never commit `.env.local` — it contains API keys
- Never call Claude API per-story — always batch minimum 10 stories per call
- Never store raw HTML in the database — strip to text only
- Never show unscored stories in the UI — everything must pass through the filter
- Never use Sonnet/Opus for the filtering pipeline — Haiku only

## Claude Learning Log
- When Claude makes a mistake in code, document the exact mistake here immediately.
- Add the failed prompt, reasoning, or pattern that produced the bug so we know not to repeat it.
- If a fix or a working prompt/approach is found, add that too with a short note on why it worked.
- Treat this file as the single source of truth for known Claude coding pitfalls and successful patterns.

---

### Build 1 — Initial full-app scaffold (Phases 1–5)

**BUG 1: `create-next-app` refuses to run in a directory with existing files**
- Symptom: `The directory signal contains files that could conflict: CLAUDE.md`
- Root cause: `create-next-app` won't init into a non-empty directory.
- Fix: scaffold into a temp sibling directory (`signal-tmp`), then `rsync -a --ignore-existing` into the real dir. Works cleanly.

**BUG 2: Supabase client created at module load → crashes Next.js static build**
- Symptom: `Error: supabaseUrl is required` during `next build`, emitted from `lib/supabase.ts`.
- Root cause: `createClient(...)` was called at the top level of the module, which runs during Next.js static generation when env vars are not present.
- Fix: wrap clients in lazy getter functions (called on first use, not on import). Early scaffold briefly used a `Proxy` re-export; that was removed (see BUG 6).
- **Pattern to follow for all future singleton clients that depend on env vars: always initialize lazily.**

**BUG 3: `web-push.setVapidDetails()` at module load → crashes Next.js static build**
- Symptom: `Error: No key set vapidDetails.publicKey` during `next build`, emitted from `lib/notifications.ts`.
- Root cause: Same as Bug 2 — `webpush.setVapidDetails(...)` was called at module top level.
- Fix: moved the call into a `configureWebPush()` helper, called at the top of `sendNotificationsForNewStories()` (runtime, not build time).
- **Pattern: any library that validates configuration on initialization must be configured lazily.**

**BUG 4: Workspace root warning — multiple `package-lock.json` files**
- Symptom: `⚠ Next.js inferred your workspace root, but it may not be correct. Detected multiple lockfiles.`
- Root cause: There's a `package-lock.json` higher up at `~/package-lock.json`.
- Fix: set `turbopack.root` in `next.config.ts` to `path.resolve(__dirname)` to pin the workspace root explicitly.

**BUG 5: `upsert` on `scored_stories` with `onConflict: 'url'` silently stores 0 rows**
- Symptom: filter pipeline runs, processes 75 stories, reports `stored: 0`. No exception thrown.
- Root cause: `scored_stories.url` has no unique constraint. Supabase returns an error for `onConflict: 'url'` but the error was only logged — `totalStored` never incremented, making it look like a silent no-op.
- Fix: replaced `upsert(..., { onConflict: 'url' })` with plain `.insert()`. Safe because `raw_stories` already deduplicates by URL upstream, and `processed = true` prevents double-scoring.
- **Pattern: never use `onConflict` on a column that doesn't have a `UNIQUE` constraint in the schema. Always verify the constraint exists before relying on it.**

**BUG 6: Proxy-based Supabase client breaks TypeScript type inference**
- Symptom: `No overload matches this call. Argument of type '...' is not assignable to parameter of type 'never'` on `.upsert()` calls through the proxy-wrapped client.
- Root cause: TypeScript cannot infer generic types through a `Proxy`. `.from('table')` returns `never` instead of the correct query builder type.
- Fix: removed Proxy entirely. Used plain `createClient(url, key)` for both clients. The lazy initialization was only needed when building without `.env.local`; once env vars are set, direct initialization works fine.
- **Pattern: never wrap Supabase clients in a Proxy. TypeScript can't see through it.** Server code uses **`getSupabaseAdmin()`** from `lib/supabase-server.ts` only (no `supabaseAdmin` Proxy alias).

**BUG 7: Wrong anon key written to .env.local (digit dropped in JWT)**
- Symptom: page loads skeleton but never resolves — stuck in infinite loading state.
- Root cause: manually transcribed the JWT and dropped a digit from the `iat` timestamp in the middle segment (`1775836461` → `1758364 61`). The key was invalid so every client-side Supabase query silently failed.
- Fix 1: corrected the key in `.env.local`.
- Fix 2: added `setLoading(false)` in the error branch of `fetchStories` so the page always resolves, even if the query fails.
- **Pattern: always paste JWT tokens directly — never retype or reconstruct them. A single wrong character invalidates the entire token.**

**BUG 8: Feed showed "No stories yet" even though filter stored rows**
- Symptom: `GET /api/filter` returned `processed > 0` and `stored > 0`, but the homepage still rendered an empty feed.
- Root cause: browser-side Supabase anon query on `scored_stories` returned 0 rows (policy/access mismatch), while service-role query returned dozens of rows. The UI depended on client-side access to data it could not read.
- Fix: moved feed read path to a server API (`/api/stories`) backed by `getSupabaseAdmin()`, then fetched from that endpoint in `app/page.tsx`.
- **Pattern: if data is critical to first render, prefer a server-side read path over client anon queries unless RLS/policies are explicitly validated for that query.**

**BUG 9: MCP global availability was missing despite project config**
- Symptom: Puppeteer MCP worked only at project scope and was not guaranteed globally across workspaces.
- Root cause: `~/.cursor/mcp.json` did not exist with the same `mcpServers` block.
- Fix: copied the exact project `mcpServers` block into global `~/.cursor/mcp.json`.
- **Pattern: when an MCP server should be reusable across projects, keep project and global MCP configs in sync.**

### Build 2 — Public auth landing, email/password, setup wizard order

**BUG 10: `/` stuck forever on “Loading…” (auth form never appeared)**
- Symptom: Only the loading string rendered; E2E could not find `#auth-email`.
- Root cause (A): `useSearchParams()` in the root client entry kept the page inside a Suspense boundary that did not resolve reliably in some environments.
- Fix: read `searchParams` in the **server** page and pass props into client children (e.g. `/auth/continue` → `AuthContinueClient`). Public `/` is **server-rendered**: `getSessionUser()` + `getServerPostAuthDestination()` then `redirect` or static `MarketingBody` — no client auth gate (avoids infinite “Loading…” when `getUser()` never settles in automation).
- Root cause (B): `supabase.auth.getUser()` stayed pending when the browser could not reach Supabase (blocked or flaky network), so `setChecked(true)` never ran.
- Fix: `Promise.race` the auth call against an ~8s timeout; on timeout or failure, treat as signed out and show the landing UI.

**BUG 11: Puppeteer / manual tests hit the wrong Next process**
- Symptom: UI did not reflect the latest code after edits.
- Root cause: a second `next dev` bound to another port while port 3000 was still held by an older dev server; tests kept using `localhost:3000`.
- Fix: stop duplicate PIDs or run a **production** server on a fixed port (`PORT=3010 npm run start` after `npm run build`) when verifying with automation.

**Note:** Supabase may reject some synthetic sign-up emails (e.g. `*@example.com`) as invalid — use a real mailbox domain in QA.

**Next.js 16:** `middleware.ts` is deprecated → use root **`proxy.ts`** with exported **`proxy`** (same `config.matcher`). Removes IDE/build warning `middleware-to-proxy`.

**BUG 14: App works on `localhost` but breaks on Cloudflare quick tunnel**
- Symptom: Tunnel URL loads or partially works; auth redirects go to `http://localhost:3000` on phone / tunnel host.
- Root cause: Behind `cloudflared`, Node still sees `request.url` as `http://localhost:3000`; `NextResponse.redirect` built from `nextUrl` used that origin.
- Fix: `lib/request-origin.ts` — `getPublicOrigin(request)` uses **`X-Forwarded-Host`** / **`X-Forwarded-Proto`** when present. Use in **`proxy.ts`** (login redirect) and **`/auth/callback`**. Logged-in **`/`** uses **`getPublicOriginFromHeaders(headers())`** for `redirect()`.
- Still required: Supabase **Redirect URLs** must include `https://<your-tunnel>.trycloudflare.com/auth/callback` (and Site URL when testing only via tunnel).

**BUG 13: Login “loop” — credentials clear, bounce back to `/login`**
- Symptom: After Log in, brief navigation then back to empty login form (or endless repeat).
- Root cause: `router.replace()` after `signInWithPassword` raced Supabase cookie persistence; the next server request (proxy / RSC) saw no session and redirected to `/login?redirect=…`.
- Fix: after successful sign-in, use **`window.location.assign(next)`** (same as sign-up with session), not App Router `router.replace`.

**BUG 12: `/` stuck on “Loading…” in Puppeteer / some browsers**
- Symptom: E2E never saw marketing copy; body text stayed `Loading…` even after 10s+.
- Root cause: client-only `MarketingOrRedirect` waited on `supabase.auth.getUser()`; when that request hung (throttled timers, flaky network, or blocked third-party calls), `checked` never flipped true.
- Fix: **`app/page.tsx`** is a Server Component — `getSessionUser()` + `getServerPostAuthDestination()` → `redirect`, else render **`MarketingBody`** immediately (`lib/auth/post-auth-redirect-server.ts`).

**Setup path (product order):** sign up / log in → **`/settings`** (Anthropic BYOK) → **`/feed`**. Optional **`/onboarding`** exists for future profile questions; not required in redirects. Implemented with `lib/auth/post-auth-navigation.ts`.

**WORKING PATTERNS:**
- Claude Haiku JSON scoring prompt: ask for a plain JSON array, no markdown fences. Then strip any accidental fences with `.replace(/^```json\s*/i, '')` before `JSON.parse`. Prevents parse failures if the model adds fences anyway.
- Supabase `upsert` with `{ onConflict: 'url', ignoreDuplicates: true }` is the right call for deduplication in both scrapers and scored stories — don't use `insert` which throws on duplicate key.
- Per-run filter prefs (topic emphasis + focus calibration) are sent as JSON `POST` to `/api/filter`; `GET` (e.g. Vercel cron) omits a body and uses default prefs in `lib/pipeline-preferences.ts`.
- Vercel cron: scrape only at `:00` of every 4th hour (BYOK filter is on-demand per user, not cron).
- Verification loop that worked well: run live app -> capture screenshot -> compare expected UI -> inspect API/DB state -> patch -> lint -> screenshot again.
- Fast diagnosis pattern: compare the same query with anon key vs service-role key; a large count mismatch immediately identifies access-layer issues (not ingestion/filter bugs).

## Database Tables
```sql
raw_stories           -- shared scraped pool (no user_id)
user_raw_scored       -- which raw rows each user has already scored
scored_stories        -- per-user filtered + scored stories (user_id)
user_api_credentials  -- encrypted Anthropic key (BYOK)
api_usage             -- token tracking per run (optional user_id)
user_profiles         -- onboarding + prefs (user_id = auth.users)
push_subscriptions    -- Web Push per user_id
```
Full schema in `supabase/schema.sql` — run this in Supabase SQL editor to create all tables.

## Environment Variables (.env.local)
```
ANTHROPIC_API_KEY=              # optional operator fallback; users use Settings (BYOK)
SECRETS_ENCRYPTION_KEY=         # required for storing user keys (openssl rand -base64 32)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```
Generate VAPID keys once with: `npx web-push generate-vapid-keys`
Template is in `.env.local.example` — copy and fill in.

**Optional tuning (filter + pool):**
```
FILTER_RAW_FETCH_LIMIT=400     # cap 800 — raw_stories rows considered per filter run
FILTER_MAX_CANDIDATES=36       # cap 200 — max unscored candidates scored per run
FILTER_BATCH_SIZE=18           # cap 40 — Haiku batch size (clamped to max candidates)
```

## Hosted Supabase checklist (migrations)

Apply new SQL migrations in the Supabase SQL editor (or `supabase db push`) when deploying:

- `supabase/migrations/20260411120000_scrape_user_throttle.sql` — DB-backed **scrape** rate limit for signed-in users.
- `supabase/migrations/20260411130000_filter_user_throttle.sql` — DB-backed **filter** rate limit (90s between runs per user, BYOK protection).
- `supabase/migrations/20260411140000_api_scored_stories_page.sql` — keyset cursor pagination for `GET /api/stories` (`api_scored_stories_page` RPC).
- `supabase/migrations/20260411150000_prune_signal_story_tables.sql` — `prune_signal_story_tables()` deletes `scored_stories` older than **7 days** and `raw_stories` older than **14 days** (run manually or schedule with **pg_cron**, e.g. weekly `SELECT public.prune_signal_story_tables();`).

Until throttle **tables** are missing, scrape/filter rate limiters **log a warning** and allow the request (deploy order never bricks the app).

## Feed API pagination

`GET /api/stories` accepts `limit` (default 20, max 80) and optional `cursor` (base64url JSON of the last row’s `{ score, scored_at, id }` from the previous page). The handler fetches **limit + 1** rows internally so `hasMore` is accurate on the last page. Response includes `hasMore` and `nextCursor` (pass as `cursor` for the next page). The feed uses **Load more** with keyset pagination so inserts do not shift pages.

## Sub-Agents
This project uses specialized Claude sub-agents defined in `.claude/agents/`:

| Agent | Role | When to invoke |
|-------|------|----------------|
| `scraper` | Fetches and parses all data sources | When adding a new source or debugging collection |
| `filter` | Manages Claude API filtering logic | When tuning scoring, adding categories |
| `briefing` | Formats and delivers output | When changing UI layout or notification logic |
| `security-performance-audit` | Report-only security + performance audit (see `.cursor/skills/security-performance-audit/SKILL.md`) | When you want a vulnerability/efficiency assessment without automatic code changes |

Invoke a sub-agent by saying: "Act as the scraper agent" or use the slash commands (`/scrape`, `/brief`, `/audit`, etc.).

**Cursor:** the same audit workflow is available as the project skill `security-performance-audit` under `.cursor/skills/`.
