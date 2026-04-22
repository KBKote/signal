import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata = {
  title: 'Docs — Dev Signal',
  description: 'Technical documentation for Dev Signal — architecture, pipeline, API, and self-hosting.',
}

function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">{label}</p>
      {children}
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-white/8 bg-white/[0.05] px-1.5 py-0.5 font-mono text-xs text-zinc-300">
      {children}
    </code>
  )
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/8 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-300">
      {children}
    </pre>
  )
}

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'data-sources', label: 'Data Sources' },
  { id: 'pipeline', label: 'Scoring Pipeline' },
  { id: 'profile', label: 'Profile Synthesis' },
  { id: 'vector-search', label: 'Vector Search' },
  { id: 'api', label: 'API Reference' },
  { id: 'environment', label: 'Environment' },
  { id: 'self-hosting', label: 'Self-Hosting' },
  { id: 'github', label: 'GitHub' },
]

export default function DocsPage() {
  return (
    <main className="relative isolate min-h-dvh bg-black text-zinc-100">
      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-12 md:px-8">
        {/* Top nav */}
        <div className="mb-12 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-white transition hover:text-zinc-300"
          >
            Dev Signal
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        <div className="flex gap-12">
          {/* Sidebar nav — sticky on desktop */}
          <aside className="hidden w-48 flex-shrink-0 lg:block">
            <div className="sticky top-8">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-700">Contents</p>
              <nav className="space-y-1">
                {NAV.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-16">
            {/* Header */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">Documentation</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white md:text-5xl">Dev Signal</h1>
              <p className="mt-4 text-lg leading-relaxed text-zinc-400">
                Personal intelligence feed for developers — powered by Claude Haiku, pgvector, and your own API key.
              </p>
            </div>

            {/* Overview */}
            <Section id="overview" label="Overview">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-4">
                <p className="text-base leading-relaxed text-zinc-300">
                  Dev Signal is a self-hosted-friendly Next.js application that scrapes the open web (RSS feeds, Reddit,
                  Hacker News), scores each story against your personal profile using Claude Haiku, and surfaces a curated
                  feed of opportunities, ideas, and ecosystem intel.
                </p>
                <p className="text-base leading-relaxed text-zinc-300">
                  It is a <strong className="text-white">BYOK (Bring Your Own Key)</strong> application. You supply your
                  own Anthropic API key. The operator (or you, if self-hosting) provides Supabase, scrape infrastructure,
                  and the OpenAI embedding key. User keys are encrypted at rest with AES-256 before storage.
                </p>
                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                  {[
                    { label: 'Frontend/Backend', value: 'Next.js 16 (App Router)' },
                    { label: 'Database', value: 'Supabase + pgvector' },
                    { label: 'AI Scoring', value: 'Claude Haiku (BYOK)' },
                    { label: 'Embeddings', value: 'OpenAI text-embedding-3-small' },
                    { label: 'Deployment', value: 'Vercel (Hobby)' },
                    { label: 'Styling', value: 'Tailwind CSS v4' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{item.label}</p>
                      <p className="mt-1 text-sm text-zinc-200">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* Architecture */}
            <Section id="architecture" label="Architecture">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                <p className="text-sm leading-relaxed text-zinc-400 mb-4">
                  Data flows through a four-stage pipeline: collect → score → store → display. Each stage is
                  independent and can be triggered manually or via cron.
                </p>
                <Pre>{`[Public web]
  └── RSS feeds (26 sources)
  └── Reddit API (19 subreddits, r/json)
  └── Hacker News (Algolia search API)
         │
         ▼
[POST /api/scrape]
  └── Deduplication via URL unique constraint
  └── raw_stories (shared pool, no user_id)
  └── OpenAI embeddings → raw_stories.embedding
         │
         ▼
[POST /api/filter]  ← user BYOK
  └── Vector search (pgvector cosine similarity)
      OR recency fallback (pool too small)
  └── Pre-filter by keyword (halves token usage)
  └── Claude Haiku batch scoring (~24 stories/batch)
  └── scored_stories (per user_id)
         │
         ▼
[GET /api/stories]
  └── Keyset pagination (score + scored_at + id)
  └── Feed page renders story cards`}</Pre>
              </div>
            </Section>

            {/* Data Sources */}
            <Section id="data-sources" label="Data Sources">
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-zinc-400">
                  All sources are free, no API keys required except Reddit (anonymous r/json endpoint).
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: 'RSS Feeds',
                      count: '26 feeds',
                      color: 'border-emerald-500/20 bg-emerald-950/10',
                      accent: 'text-emerald-700',
                      detail: 'CoinDesk, Decrypt, The Block, Bankless, HuggingFace, The Verge, MIT Tech Review, Wired, DL News, OpenAI Blog, Anthropic, a16z, Ethereum Foundation, and more.',
                    },
                    {
                      label: 'Reddit',
                      count: '19 subreddits',
                      color: 'border-sky-500/20 bg-sky-950/10',
                      accent: 'text-sky-700',
                      detail: 'r/ethereum, r/ethdev, r/LocalLLaMA, r/MachineLearning, r/defi, r/MEVResearch, r/AIAgents, r/agentdevelopment, r/mcp_ai, and more.',
                    },
                    {
                      label: 'Hacker News',
                      count: 'Algolia API',
                      color: 'border-white/8 bg-white/[0.03]',
                      accent: 'text-zinc-600',
                      detail: 'Front-page stories via the Algolia HN search API. Configurable tag and score filters.',
                    },
                    {
                      label: 'Scrape rate limit',
                      count: '2 min / user',
                      color: 'border-white/8 bg-white/[0.03]',
                      accent: 'text-zinc-600',
                      detail: 'DB-backed rate limiter prevents hammering sources. The shared pool means one scrape benefits all users.',
                    },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-2xl border p-5 ${item.color}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`font-mono text-[10px] uppercase tracking-widest ${item.accent}`}>{item.label}</p>
                        <span className="font-mono text-xs text-zinc-500">{item.count}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-400">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* Pipeline */}
            <Section id="pipeline" label="Scoring Pipeline">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                  <p className="text-sm leading-relaxed text-zinc-300 mb-4">
                    The scoring pipeline runs entirely on-demand per user. It is never a background job during scoring —
                    latency is predictable and costs are 1:1 with usage.
                  </p>
                  <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">1. Candidate selection</p>
                      <p>
                        Vector search retrieves the top-N unscored stories by cosine similarity to your profile
                        embedding. Falls back to recency if the profile has no embedding or fewer than 20 results
                        are returned.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">2. Keyword pre-filter</p>
                      <p>
                        Before any Claude call, stories are pre-filtered by a keyword list derived from your topic
                        emphasis. This typically halves the token count sent to Haiku.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">3. Haiku batch scoring</p>
                      <p>
                        Stories are batched (~24 per call) and scored by <Code>claude-haiku-4-5</Code> using
                        your <Code>scoring_markdown</Code> profile as the scoring rubric. Each story gets a
                        score 1–10, a category (opportunity / idea / intel / noise), and a brief "why it matters."
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">4. Storage</p>
                      <p>
                        Stories scoring ≥ 5 are stored in <Code>scored_stories</Code>. Noise (score 1–4) is
                        discarded. All scored raw story IDs are recorded in <Code>user_raw_scored</Code> so
                        they're never scored again.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Token budgets</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { preset: 'Light', candidates: 40, batch: 20, tokens: '~6.5K in / 4.5K out' },
                      { preset: 'Standard', candidates: 80, batch: 24, tokens: '~13K in / 9K out' },
                      { preset: 'Deep', candidates: 150, batch: 30, tokens: '~25K in / 17K out' },
                    ].map((p) => (
                      <div key={p.preset} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="font-medium text-zinc-100 text-sm">{p.preset}</p>
                        <p className="mt-1 font-mono text-xs text-zinc-500">{p.candidates} candidates</p>
                        <p className="font-mono text-xs text-zinc-600">{p.tokens}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Profile Synthesis */}
            <Section id="profile" label="Profile Synthesis">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-4">
                <p className="text-sm leading-relaxed text-zinc-300">
                  When you complete onboarding, your questionnaire answers are sent to{' '}
                  <Code>claude-sonnet-4-6</Code> (once, using your BYOK) to synthesize a structured
                  scoring profile in markdown. This markdown — not your raw answers — is what Claude
                  Haiku sees when scoring your feed.
                </p>
                <p className="text-sm leading-relaxed text-zinc-400">
                  The profile includes: who you are, what you're building, ecosystem focus, must-score-high /
                  must-score-low lists, knowledge baseline (so Haiku doesn't explain things you already know),
                  and a scoring rubric calibrated to your goals.
                </p>
                <p className="text-sm leading-relaxed text-zinc-400">
                  After synthesis, the profile text is also embedded via OpenAI (
                  <Code>text-embedding-3-small</Code>) and stored in{' '}
                  <Code>user_profiles.profile_embedding</Code> for vector candidate selection.
                </p>
                <div className="mt-2 rounded-xl border border-white/8 bg-black/40 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Cost breakdown</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Sonnet synthesis (once)</span>
                      <span className="font-mono text-zinc-400">~$0.002–0.005</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Haiku scoring (Standard run)</span>
                      <span className="font-mono text-zinc-400">~$0.01–0.02</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">OpenAI embeddings (per scrape)</span>
                      <span className="font-mono text-zinc-400">~$0.001</span>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Vector Search */}
            <Section id="vector-search" label="Vector Search">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-4">
                <p className="text-sm leading-relaxed text-zinc-300">
                  Dev Signal uses pgvector (Supabase's vector extension) to pre-select the most
                  semantically relevant candidates before scoring. This improves result quality and
                  reduces Haiku token usage by only scoring stories that are actually relevant to your
                  profile.
                </p>
                <div className="space-y-3 text-sm text-zinc-400">
                  <div>
                    <p className="font-medium text-zinc-200 mb-1">Story embeddings</p>
                    <p>
                      Every scraped story has its title + summary + raw_text embedded via OpenAI at
                      scrape time. Stored in <Code>raw_stories.embedding</Code> (1536 dimensions).
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200 mb-1">Profile embedding</p>
                    <p>
                      Your scoring markdown is embedded after synthesis and stored in{' '}
                      <Code>user_profiles.profile_embedding</Code>. Re-synthesizing your profile
                      updates this automatically.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200 mb-1">match_stories_for_user RPC</p>
                    <p>
                      A Postgres function using the <Code>{'<=>'}</Code> cosine distance operator
                      returns the top-N unscored stories closest to your profile embedding. The function
                      excludes already-scored rows server-side, so you never see duplicate results.
                    </p>
                  </div>
                </div>
                <Pre>{`-- Core RPC (simplified)
SELECT rs.id, rs.title, rs.url, rs.source, rs.raw_text,
       1 - (rs.embedding <=> p_embedding) AS similarity
FROM raw_stories rs
WHERE rs.embedding IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_raw_scored urs
    WHERE urs.raw_story_id = rs.id AND urs.user_id = p_user_id
  )
ORDER BY rs.embedding <=> p_embedding
LIMIT p_match_count;`}</Pre>
              </div>
            </Section>

            {/* API Reference */}
            <Section id="api" label="API Reference">
              <div className="space-y-3">
                {[
                  {
                    method: 'POST',
                    path: '/api/scrape',
                    auth: 'Session',
                    desc: 'Trigger a scrape run. Fetches RSS feeds, Reddit, and HN; deduplicates by URL; generates embeddings for new stories. Rate-limited to 2 minutes per user.',
                  },
                  {
                    method: 'POST',
                    path: '/api/filter',
                    auth: 'Session + BYOK',
                    desc: 'Run the scoring pipeline. Selects candidates via vector search, pre-filters by keyword, batches to Claude Haiku. Rate-limited to 90 seconds per user.',
                  },
                  {
                    method: 'GET',
                    path: '/api/stories',
                    auth: 'Session',
                    desc: 'Paginated feed. Accepts limit (max 80) and cursor (base64 keyset). Returns stories with score ≥ 5, ordered by score DESC then scored_at DESC.',
                  },
                  {
                    method: 'GET',
                    path: '/api/pool-state',
                    auth: 'Session',
                    desc: 'Returns pool statistics: rawWindow (total stories in 72h window), scoredInWindow, unscoredEligible. Used by the feed to decide whether to auto-scrape before scoring.',
                  },
                  {
                    method: 'POST',
                    path: '/api/onboarding/synthesize-profile',
                    auth: 'Session + BYOK',
                    desc: 'Runs the Sonnet profile synthesis. Validates answers, calls Claude Sonnet, persists scoring_markdown and profile_embedding. One-time cost.',
                  },
                  {
                    method: 'POST',
                    path: '/api/admin/backfill-embeddings',
                    auth: 'CRON_SECRET',
                    desc: 'Backfill OpenAI embeddings for existing raw_stories rows where embedding IS NULL. Keyset-paginated, stops at 200s to avoid Vercel timeout.',
                  },
                ].map((route) => (
                  <div key={route.path} className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          route.method === 'POST'
                            ? 'bg-emerald-950/50 text-emerald-400'
                            : 'bg-sky-950/50 text-sky-400'
                        }`}
                      >
                        {route.method}
                      </span>
                      <code className="font-mono text-sm text-zinc-200">{route.path}</code>
                      <span className="ml-auto font-mono text-[10px] text-zinc-600">{route.auth}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">{route.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Environment Variables */}
            <Section id="environment" label="Environment Variables">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                <Pre>{`# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Encryption key for user BYOK storage (required)
# Generate: openssl rand -base64 32
SECRETS_ENCRYPTION_KEY=

# OpenAI — used for story + profile embeddings (required)
OPENAI_API_KEY=

# Anthropic — used for profile synthesis route model id (required)
ANTHROPIC_PROFILE_MODEL=claude-sonnet-4-6

# Optional Anthropic operator key (not used for user flows)
ANTHROPIC_API_KEY=

# Cron authentication for admin endpoints
CRON_SECRET=

# VAPID keys for Web Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

# Optional tuning
FILTER_RAW_FETCH_LIMIT=800   # max stories considered per run
FILTER_MAX_CANDIDATES=300    # server ceiling for candidates per run (default 300; lower to save cost)
FEED_MAX_AGE_DAYS=7          # story age window`}</Pre>
              </div>
            </Section>

            {/* Self-Hosting */}
            <Section id="self-hosting" label="Self-Hosting">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 space-y-4">
                  <p className="text-sm leading-relaxed text-zinc-300">
                    Dev Signal is designed to run on Vercel Hobby + Supabase free tier. No paid
                    infrastructure required for personal use.
                  </p>
                  <div className="space-y-3 text-sm text-zinc-400">
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">1. Clone and install</p>
                      <Pre>{`git clone https://github.com/KBKote/signal
cd signal
npm install`}</Pre>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">2. Set up Supabase</p>
                      <p>
                        Create a free project at{' '}
                        <a href="https://supabase.com" className="text-zinc-300 underline underline-offset-2 hover:text-white" target="_blank" rel="noopener noreferrer">
                          supabase.com
                        </a>
                        . Run all migrations in{' '}
                        <Code>supabase/migrations/</Code> in the SQL editor, in order.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">3. Configure environment</p>
                      <p>
                        Copy <Code>.env.local.example</Code> to <Code>.env.local</Code> and fill in
                        all required values. Generate your encryption key with{' '}
                        <Code>openssl rand -base64 32</Code>.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200 mb-1">4. Deploy</p>
                      <p>
                        Push to Vercel. Add all environment variables in the Vercel project settings.
                        Set up the cron in <Code>vercel.json</Code> (already configured for daily scrape
                        at 00:00 UTC — Hobby limit is once per day).
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-2">Migrations checklist</p>
                  <p className="text-sm text-zinc-400 mb-3">Run these SQL files in the Supabase editor in order:</p>
                  <div className="space-y-1 font-mono text-xs text-zinc-500">
                    {[
                      '20260411120000_scrape_user_throttle.sql',
                      '20260411130000_filter_user_throttle.sql',
                      '20260411140000_api_scored_stories_page.sql',
                      '20260411150000_prune_signal_story_tables.sql',
                      '20260412100000_scoring_markdown.sql',
                      '20260412200000_atomic_rate_limit.sql',
                      '20260412210000_auth_rate_limit.sql',
                      '20260422091500_raw_stories_summary_column.sql',
                      '20260422100000_pgvector_embeddings.sql',
                      '20260422103000_match_stories_for_user_uuid_return_fix.sql',
                      '20260422110000_fix_ivfflat_probes.sql',
                    ].map((f) => (
                      <p key={f}>&gt; {f}</p>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* GitHub */}
            <Section id="github" label="GitHub">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Source code</p>
                <p className="text-base text-zinc-300 mb-5">
                  Dev Signal is open source. Read the code, open issues, or fork it for your own use.
                </p>
                <a
                  href="https://github.com/KBKote/signal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  github.com/KBKote/signal
                  <ExternalLink className="h-3 w-3 text-zinc-500" />
                </a>
              </div>
            </Section>

            <div className="border-t border-white/8 pt-8 text-center">
              <Link href="/" className="text-sm text-zinc-600 transition hover:text-zinc-400">
                ← Back to Dev Signal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
