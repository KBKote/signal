# Claude Code Role & Workflow

> **This section is for Claude Code only. Cursor reads `.cursorrules` / cursor project rules — not this file.**

## My Role
I am the **code analyst, auditor, and discussion partner** for this project. I do not write or edit code directly. All code changes go through Cursor.

## Workflow

### Step 1 — Diagnose
We discuss the problem. I read the relevant files, trace the root cause, and explain exactly what needs to change and why.

### Step 2 — Plan prompt (→ Cursor)
I write a Cursor prompt that asks Cursor to **plan** the fix — no code written yet. The plan must include:
- Which files change and why
- What each change does (the logic, not just the line)
- What the correct end state looks like

### Step 3 — Review the plan
I read Cursor's plan and check it against the root cause and the constraints in this file. I flag anything wrong, missing, or over-engineered.

### Step 4 — Revision prompt (→ Cursor) [if needed]
If the plan needs changes, I write a targeted Cursor prompt to revise specific parts. Repeat until the plan is correct.

### Step 5 — Build prompt (→ Cursor)
Once the plan is approved, I write the build prompt. The build prompt must instruct Cursor to:
1. Implement each change exactly as planned
2. After each file is changed, **re-read that file** and compare the result to what the plan said it should look like — not just run lint, but actually verify the logic is correct
3. Cross-check against the constraints in `CLAUDE.md` (cost controls, security patterns, working patterns, known bugs)
4. Run `npm run lint` and `npm run test` as a final gate
5. Report any deviation from the plan before declaring done

---

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
npm run dev:fresh  # rm -rf .next then dev — use when NEXT_PUBLIC_* still shows CI placeholder after env fix (Bug 16)
npm run tunnel     # Public HTTPS URL via Cloudflare quick tunnel (run in a second terminal; needs dev on :3000)
npm run build      # Build for production (`next build --webpack` — stable vs intermittent Turbopack ENOENT on manifests in some environments)
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
[Public `/`] → product copy + Log in / Sign up → `/login` → verify email → BYOK in `/settings` → `/onboarding` (scoring profile) → `/feed`
[Supabase Auth] → session (cookie) → protected /feed, /settings, /onboarding
       ↓
[Cron: daily on Vercel Hobby] (scrape only — filter is on-demand per user with BYOK; `vercel.json` uses `0 0 * * *` because Hobby allows at most one cron invocation per day)
       ↓
[Scraper]       → fetches RSS + Reddit + HN → shared raw_stories pool
       ↓
[User: Run Pipeline] → decrypt their Anthropic key → Claude Haiku batches → scored_stories (per user_id)
       ↓
[Web App]       → /api/stories (session) → feed by category
       ↓
[Push Notif]    → user's subscriptions → high-score opportunities for that user
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
- Use `claude-haiku-4-5-20251001` ONLY for **batch filtering** in [`lib/filter.ts`](lib/filter.ts) — never Sonnet or Opus there
- **Sonnet allowed only for one-shot profile synthesis** via [`POST /api/onboarding/synthesize-profile`](app/api/onboarding/synthesize-profile/route.ts) — **never** in [`lib/filter.ts`](lib/filter.ts) batch loop. Uses user BYOK and **`ANTHROPIC_PROFILE_MODEL`** (required at runtime for that route; set in `.env.local` / Vercel — see `.env.local.example`). Log usage to **`api_usage`** with Sonnet pricing ($3/M input, $15/M output)
- Always batch stories into a single prompt (never one API call per story)
- Pre-filter by keyword BEFORE sending to Claude (halves token usage)
- Target: < $3/month in API costs
- Log token usage on every Claude API call to `api_usage` table

## Constraints — Never Do These
- Never commit `.env.local` — it contains API keys
- Never call Claude API per-story — always batch minimum 10 stories per call
- Never store raw HTML in the database — strip to text only
- Never show unscored stories in the UI — everything must pass through the filter
- Never use Sonnet/Opus **inside** the filtering pipeline / `scoreBatch` — Haiku only; Sonnet is allowed **only** on the profile synthesis route above

## Claude Learning Log

- When Claude makes a mistake in code, document the exact mistake here immediately.
- Add the failed prompt, reasoning, or pattern that produced the bug so we know not to repeat it.
- If a fix or a working prompt/approach is found, add that too with a short note on why it worked.
- Treat this file as the single source of truth for known Claude coding pitfalls and successful patterns.

**Pattern — low feed count after topic emphasis:** A single hard `MIN_SCORE_TO_STORE` plus a low `MAX_CANDIDATES` default made the feed look empty even when Haiku ran. Fix: **scope-aware store floors** (`minScoreToStoreForScope`: precise 6, balanced 5, expansive 4 in [`lib/pipeline-preferences.ts`](lib/pipeline-preferences.ts)), **raise default `MAX_CANDIDATES` to 80** and **`BATCH_SIZE` to 24**, **scope-aware overlay** (do not tell expansive runs to default to noise), and align **`/api/stories`** `MIN_FEED_SCORE` to **4** so stored 4s appear. Reddit topic-pack subs still on `t=week` were moved to **`t=day`** for fresher pools.

**WORKING PATTERN — gated setup (email → BYOK → `scoring_markdown`):** Centralize checks in [`lib/auth/user-setup-gates.ts`](lib/auth/user-setup-gates.ts) (`getUserSetupGates`, `nextSetupPath`, `assertUserReadyForPipeline`). [`proxy.ts`](proxy.ts) forces verified email for `/feed`, `/settings`, `/onboarding`; server layouts on feed/settings/onboarding mirror the same order; privileged APIs (`/api/filter`, `/api/stories`, reset-progress, push, user scrape) call `assertUserReadyForPipeline` so the browser cannot skip gates. Confirmed: server + session scoped admin queries hold — `loadUserProfileRow` always `.eq('user_id', userId)`.

**BUG 15: `getServerPostAuthDestination(userId)` could not see `email_confirmed_at`**
- Symptom: Logged-in users skipped email verification and scoring-profile gates.
- Root cause: Destination helper only checked BYOK via `userId`, not `User.email_confirmed_at` or `scoring_markdown`.
- Fix: Pass full `User` into `getServerPostAuthDestination(user)`; share `getUserSetupGates` / `nextSetupPath` with client status API; add `/verify-email` and migration-backed `scoring_markdown` column for `hasScoringProfile`.
- **Temporary:** `hasScoringProfile` is true if `scoring_markdown` is set **or** legacy `onboarding_completed` is true (old JSON onboarding before Sonnet synthesis). Tighten to markdown-only after Phase 2 migration of existing users.

**WORKING PATTERN — Vitest + `@/` imports:** Use root [`vitest.config.ts`](vitest.config.ts) with `resolve.alias: { '@': path.resolve(__dirname, '.') }` so tests can import `@/lib/...` like Next.js. Run `npm run test` (Vitest `vitest run`).

**WORKING PATTERN — Sonnet profile synthesis (Phase 2b):** [`POST /api/onboarding/synthesize-profile`](app/api/onboarding/synthesize-profile/route.ts) uses **only** `getDecryptedAnthropicKey(user.id)` (never `ANTHROPIC_API_KEY` for users). Instantiate `new Anthropic({ apiKey })` **inside** the request path. Model id **only** from `process.env.ANTHROPIC_PROFILE_MODEL` (no hardcoded fallback in app code — route returns **503** `missing_profile_model` if unset). After Sonnet returns text, require substrings `## Who I Am` and `## Scoring Rubric`; **retry once** with the same user prompt if either is missing; if still missing, **500** `{ error: 'synthesis_failed' }` and **do not** upsert. On success: `loadUserProfileRow` then upsert `user_profiles` with existing **`profile`** + **`onboarding_completed`** preserved, set `scoring_markdown`, `questionnaire_answers`, `synthesized_at`. Insert **`api_usage`** with aggregated input/output tokens and Sonnet cost estimate ($3/M in, $15/M out). Client errors: machine keys like `add_key_first`, `verify_email_first`, `invalid_answers` + `detail` — never stack traces.

**WORKING PATTERN — `user_profiles` upsert without wiping jsonb:** Before any `upsert` on `user_profiles` for synthesis or settings markdown, **`loadUserProfileRow(userId)`** and re-pass **`profile`** and **`onboarding_completed`** from the loaded row (defaults `{}` / `true` only when no row). Same `{ onConflict: 'user_id' }` pattern for PATCH scoring markdown.

**BUG 16: Client shows `placeholder.supabase.co` / `fetch failed` to Supabase despite correct `.env.local`**
- Symptom: Debug logs or `getSupabasePublicUrl()` in the browser resolve to **`placeholder.supabase.co`**; server auth returns "Could not reach Supabase…"; real keys in `.env.local` seem ignored.
- Root cause: **Turbopack/Webpack inlines `NEXT_PUBLIC_*` at compile time.** If `.next` was produced when env was missing or set to **CI placeholders**, **restarting `next dev` does not replace** those inlined values — the stale client/server chunks keep the placeholder until the cache is cleared.
- Fix: **`rm -rf .next`** then **`npm run dev`** (from repo root), or **`npm run dev:fresh`** for the same in one command.

**WORKING PATTERN — Nitter RSS scraping:** [`lib/scraper/nitter.ts`](lib/scraper/nitter.ts) uses `rss-parser` (no new packages) with a curated list of accounts in [`NITTER_USERNAMES`](lib/scrape-sources.ts) and three fallback instance origins in `NITTER_INSTANCE_ORIGINS`. `Promise.allSettled` per username with per-instance `try/catch` on `parser.parseURL`; `source` field: `twitter/<username>` (lowercase slug). Wired in [`POST/GET /api/scrape`](app/api/scrape/route.ts) as a fourth parallel collector; response `breakdown.nitter`. **NOTE:** Public Nitter instance uptime is unreliable — `breakdown.nitter === 0` with per-instance logs means hosts were down or blocked, not necessarily a code bug.

**WORKING PATTERN — Haiku batch JSON recovery and throughput:** [`lib/filter.ts`](lib/filter.ts) runs **two** `scoreBatch` calls in parallel per wave (`BATCH_CONCURRENCY = 2`). **`max_tokens: 8192`** avoids truncating large batches (~30 items × long summaries). Parsing uses **`tryParseScoredArray`**: direct `JSON.parse`, unwrap common object wrappers (`stories`, `results`, `items`, `scores`), then **`extractJsonArrayStringAware`** so brackets inside JSON strings do not break depth counting. On failure, log **`stop_reason`** and **`output_tokens`**, and surface **`parseFailureBatchIndices`** in [`app/api/filter/route.ts`](app/api/filter/route.ts). Keep **`runFilterPipeline`** return shape in sync with that route or TypeScript build fails.

**WORKING PATTERN — feed freshness (`published_at`):** Env **`FEED_MAX_AGE_DAYS`** (default **7**, cap **30** in filter via `intEnv`): [`lib/filter.ts`](lib/filter.ts) skips raw candidates older than the window (missing **`published_at`** still scores). [`app/api/stories/route.ts`](app/api/stories/route.ts) applies the same window on the **REST** path with **`.or(published_at.is.null,published_at.gte…)`**; **`api_scored_stories_page`** RPC does not yet filter by `published_at` — server logs note the gap until a migration extends the RPC.

**OBSERVATION — `next build` killed in constrained environments:** A full `next build` may exit with **137/143** (SIGKILL/SIGTERM) when the host enforces low memory or short timeouts (e.g. agent sandbox). `npm run lint` succeeding is the minimum gate in those environments; confirm `npm run build` on a normal dev machine or CI with adequate resources.

**WORKING PATTERN — DitheringShader page backgrounds:** [`components/ui/dithering-shader.tsx`](components/ui/dithering-shader.tsx) (raw WebGL2, no Three.js, no `cn` import) wrapped by [`components/ui/page-background.tsx`](components/ui/page-background.tsx) (`fixed`, `inset-0`, `z-[-1]`, `pointer-events-none`). Per-page shape presets: **feed** = `ripple`, **onboarding** = `swirl`, **login / verify-email** = `simplex`. Colors stay monochrome in the **#010101–#202020** range. **`app/settings/page.tsx`:** still needs `<PageBackground shape="warp" colorBack="#010101" colorFront="#181818" pxSize={7} speed={0.15} />` (pending).

**OBSERVATION — topic mode UX problem:** Topic modes (Macro & Markets, Developer & Infra, etc.) only produce good results if the raw story pool contains matching content. The pool is currently AI/crypto-heavy (22 RSS feeds + 11 subreddits all in that niche). Switching to "Macro & Markets" correctly penalizes AI stories but finds almost no macro content to surface — returns 1-13 stories of wrong type. **Decision pending:** may remove topic mode selector entirely and rely solely on `scoring_markdown` for personalization, keeping only scope (precise/balanced/expansive). Do not add more topic modes without first adding matching sources.

**OBSERVATION — pool depletion pattern:** `user_raw_scored` permanently marks every scored story. After multiple pipeline runs, the candidate pool empties and runs return 0-5 stories even with Deep budget. Fix: run the scraper first (Step 1 of pipeline) to replenish `raw_stories` with fresh content before scoring. This is expected behavior, not a bug.

**OBSERVATION — token cost breakdown:** Output tokens are 5× more expensive than input ($4/M vs $0.80/M). For a standard run (~26K input + ~15K output), output is 74% of cost. `scoreBatch` word caps (`why` capped at 12 words, `summary` at 20 words) target that cost.

**KNOWN GAPS (not yet fixed):** DB transactions across filter writes; encryption key rotation; Zod schema validation on API inputs; observability/structured logging.

**ROADMAP — next session priorities:**
1. **Nitter Twitter integration** — scrape curated list of 20-30 high-signal crypto/MEV/DeFi accounts via Nitter RSS (free, no API key). Use multiple fallback Nitter instances. Wire into existing RSS scraper infrastructure. Topic-specific account packs. Goal: catch opportunities like the Polymarket 12-second delay that surface on Twitter 2-3 days before RSS/Reddit.
2. **Visual shader consistency** — carry the radial gradient blob from the home page through feed and settings pages. Different direction/color per page for variety.
3. **Custom SMTP** — configure a third-party SMTP provider (e.g. Resend, Postmark, or SendGrid) in Supabase Auth settings to replace the built-in mailer. Goal: lift the Supabase free-tier email limits (3 emails/hour) so verification and magic-link emails are reliable at scale.
4. **Dedicated scrape worker** — move `/api/scrape` logic to a separate lightweight service (Railway, Fly.io, or Cloudflare Worker) with no Vercel 60s timeout constraint. Calls the same Supabase `raw_stories` table. Benefits: unlimited source count, true on-demand scraping without cron dependency, no timeout risk when adding more feeds. Haiku scoring stays in Next.js unchanged — only the scrape layer moves. Do NOT use a vector DB for this; the retrieval bottleneck is not the problem, Haiku batch scoring already handles relevance efficiently.

---

**Next.js 16:** `middleware.ts` is deprecated → use root **`proxy.ts`** with exported **`proxy`** (same `config.matcher`).

**Setup path (product order):** sign up / log in → **`/verify-email`** (if Supabase requires confirmation) → **`/settings`** (Anthropic BYOK) → **`/onboarding`** (until `user_profiles.scoring_markdown` is set) → **`/feed`**. Implemented with `lib/auth/post-auth-navigation.ts`, `lib/auth/user-setup-gates.ts`, and server layouts under `app/feed`, `app/settings`, `app/onboarding`.

**Supabase `upsert` deduplication:** use `{ onConflict: 'url', ignoreDuplicates: true }` for `raw_stories` (has a unique constraint on URL). For `scored_stories`, use plain `.insert()` — it has no unique constraint on URL.

**Per-run filter prefs** (topic emphasis + focus calibration) are sent as JSON `POST` to `/api/filter`; `GET` (e.g. Vercel cron) omits a body and uses default prefs in `lib/pipeline-preferences.ts`.

**Vercel cron (Hobby):** scrape once daily at `00:00` UTC (`0 0 * * *` in `vercel.json`). More frequent schedules fail deploy on Hobby; use Pro or an external scheduler if you need `/api/scrape` more often.

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
ANTHROPIC_API_KEY=              # optional operator-only key for future server jobs — NEVER used as fallback for signed-in user flows (filter/synthesis always use BYOK via getDecryptedAnthropicKey)
ANTHROPIC_PROFILE_MODEL=        # required for POST /api/onboarding/synthesize-profile (Sonnet model id, e.g. claude-sonnet-4-6)
ANTHROPIC_HAIKU_MODEL=          # optional override for batch filtering in lib/filter.ts (blank = built-in default Haiku id)
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
FILTER_RAW_FETCH_LIMIT=800     # cap 800 — raw_stories rows considered per filter run (Phase 4 default in .env.local)
FILTER_MAX_CANDIDATES=150      # cap 200 — max unscored candidates scored per run
FILTER_BATCH_SIZE=24           # cap 40 — Haiku batch size (clamped to max candidates)
FEED_MAX_AGE_DAYS=7            # max age in days for scoring + REST feed by published_at (filter uses intEnv 1–30; stories route parseInt, default 7)
```

## Hosted Supabase checklist (migrations)

Apply new SQL migrations in the Supabase SQL editor (or `supabase db push`) when deploying:

- `supabase/migrations/20260411120000_scrape_user_throttle.sql` — DB-backed **scrape** rate limit for signed-in users.
- `supabase/migrations/20260411130000_filter_user_throttle.sql` — DB-backed **filter** rate limit (90s between runs per user, BYOK protection).
- `supabase/migrations/20260411140000_api_scored_stories_page.sql` — keyset cursor pagination for `GET /api/stories` (`api_scored_stories_page` RPC).
- `supabase/migrations/20260411150000_prune_signal_story_tables.sql` — `prune_signal_story_tables()` deletes `scored_stories` older than **7 days** and `raw_stories` older than **14 days** (run manually or schedule with **pg_cron**, e.g. weekly `SELECT public.prune_signal_story_tables();`).
- `supabase/migrations/20260412100000_scoring_markdown.sql` — `user_profiles.scoring_markdown`, `questionnaire_answers`, `synthesized_at` (gated onboarding / Haiku scoring context).
- `supabase/migrations/20260412200000_atomic_rate_limit.sql` — atomic RPCs `take_filter_rate_slot` / `take_scrape_rate_slot` (TOCTOU-safe per-user throttle).
- `supabase/migrations/20260412210000_auth_rate_limit.sql` — `auth_rate_limit` table + `check_auth_rate_limit` RPC (sign-in/sign-up brute-force protection).

Until throttle **tables** are missing, scrape/filter rate limiters **log a warning** and allow the request (deploy order never bricks the app).

## Feed API pagination

`GET /api/stories` accepts `limit` (default 20, max 80) and optional `cursor` (base64url JSON of the last row's `{ score, scored_at, id }` from the previous page). The handler fetches **limit + 1** rows internally so `hasMore` is accurate on the last page. Response includes `hasMore` and `nextCursor` (pass as `cursor` for the next page). The feed uses **Load more** with keyset pagination so inserts do not shift pages.

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
