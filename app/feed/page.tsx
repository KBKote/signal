'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FeedCard, type Story } from '@/components/FeedCard'
import { CategoryFilter, type Category } from '@/components/CategoryFilter'
import { PipelineProgress, type StepState } from '@/components/PipelineProgress'
import {
  DEFAULT_PIPELINE_PREFS,
  PipelinePreferencesPanel,
  type PipelinePreferences,
} from '@/components/PipelinePreferences'
import {
  canSubmitPipelinePrefs,
  DEFAULT_PIPELINE_RUN_TUNING,
  parseStoredLastPipelinePrefs,
  stablePipelinePrefsKey,
  AUTO_SCRAPE_POOL_FLOOR,
  type PipelineRunTuning,
} from '@/lib/pipeline-preferences'
import { FeedIntro } from '@/components/FeedIntro'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000
const STORIES_PAGE_SIZE = 25

/** Static chip copy — what each label means (counts above stay live). */
const STAT_CHIP_HELP = {
  stories:
    'Scored items in your feed right now (this page loads in batches — use Load more for the rest).',
  opportunities:
    'Stories Claude tagged as opportunities: concrete edges, launches, or positioning worth acting on or tracking closely.',
  ideas:
    'Stories tagged as ideas: directions, projects, or theses worth exploring or building on — less urgent than opportunities.',
  intel:
    'Stories tagged as intel: background, trends, and context for awareness — useful to read, not necessarily to act on immediately.',
} as const

const TERMINAL_LINES = [
  'sources/rss          26 feeds (coindesk, decrypt, huggingface, theblock…)',
  'sources/reddit       19 subreddits (ethereum, LocalLLaMA, ethdev, MEV…)',
  'sources/hn           front-page via Algolia HN search API',
  'pipeline/model       claude-haiku-4-5 · BYOK · batch mode',
  'pipeline/threshold   min score ≥ 5 stored · score ≥ 8 = opportunity',
  'pipeline/context     user profile + topic overlay injected per batch',
]

const INITIAL_PIPE_STEPS = [
  { label: 'Collect new stories (scrape if needed)', state: 'pending' as StepState },
  { label: 'Score new stories (Claude Haiku)', state: 'pending' as StepState },
  { label: 'Reload feed from database', state: 'pending' as StepState },
]

function filterRequestBody(prefs: PipelinePreferences, tuning: PipelineRunTuning) {
  return JSON.stringify({
    topicMode: prefs.topicMode,
    topicCustom: prefs.topicMode === 'other' ? prefs.topicCustom : '',
    scope: prefs.scope,
    maxCandidates: tuning.maxCandidates,
    batchSize: tuning.batchSize,
  })
}

async function readJsonError(res: Response, fallback: string): Promise<string> {
  const j = (await res.json().catch(() => ({}))) as { error?: unknown }
  return typeof j.error === 'string' ? j.error : fallback
}

export default function LiveFeedPage() {
  // 'pending'  — waiting for mount to check sessionStorage (black cover prevents feed flash)
  // 'show'     — play the intro animation
  // 'skip'     — intro already seen, go straight to feed
  const [introState, setIntroState] = useState<'pending' | 'show' | 'skip'>('pending')

  useEffect(() => {
    const seen = sessionStorage.getItem('signal-intro-seen')
    setIntroState(seen ? 'skip' : 'show')
  }, [])

  const handleIntroDone = useCallback(() => {
    sessionStorage.setItem('signal-intro-seen', '1')
    setIntroState('skip')
  }, [])

  const [stories, setStories] = useState<Story[]>([])
  const [category, setCategory] = useState<Category>('all')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [runningPipeline, setRunningPipeline] = useState(false)
  const [scrapingFresh, setScrapingFresh] = useState(false)
  const [pipelineMessage, setPipelineMessage] = useState('Ready.')
  const [pipeSteps, setPipeSteps] = useState(INITIAL_PIPE_STEPS)
  const [pipelinePrefs, setPipelinePrefs] = useState<PipelinePreferences>(DEFAULT_PIPELINE_PREFS)
  const [pipelineRunTuning, setPipelineRunTuning] = useState<PipelineRunTuning>(DEFAULT_PIPELINE_RUN_TUNING)
  const [lastRunStats, setLastRunStats] = useState<{
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    stored: number
    batches: number
    candidatePoolSize: number
    candidateCap: number
    batchSizeUsed: number
    serverEnvMaxCandidates: number
  } | null>(null)
  const [lastRunData, setLastRunData] = useState<{
    run_at: string
    input_tokens: number | null
    output_tokens: number | null
    estimated_cost: number | string | null
    stories_scored: number | null
  } | null>(null)
  const [liveLog, setLiveLog] = useState<string[]>(['> pipeline idle — waiting for run…'])
  const liveLogRef = useRef<HTMLDivElement>(null)
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [hasMoreStories, setHasMoreStories] = useState(false)
  const [storiesNextCursor, setStoriesNextCursor] = useState<string | null>(null)
  const [loadingMoreStories, setLoadingMoreStories] = useState(false)
  const [poolState, setPoolState] = useState<{
    unscoredEligible: number
    rawWindow: number
    scoredInWindow: number
    feedMaxAgeDays: number
    rawFetchLimit: number
  } | null>(null)
  const pipelineRunningRef = useRef(false)
  /** Prefs from the last successful `/api/filter` (server also stores under `profile.last_pipeline_prefs`). */
  const lastSuccessfulPipelinePrefsRef = useRef<PipelinePreferences | null>(null)

  useEffect(() => {
    void fetch('/api/onboarding', { credentials: 'include' }).then(async (r) => {
      if (!r.ok) return
      const j = (await r.json()) as { profile?: Record<string, unknown> }
      const parsed = parseStoredLastPipelinePrefs(j.profile?.last_pipeline_prefs)
      if (parsed) {
        lastSuccessfulPipelinePrefsRef.current = parsed
      }
    })
  }, [])

  useEffect(() => {
    void fetch('/api/settings/status', { credentials: 'include' }).then(async (r) => {
      if (r.ok) {
        const j = await r.json()
        setHasAnthropicKey(Boolean(j.hasAnthropicKey))
      }
    })
  }, [])

  useEffect(() => {
    void fetch('/api/settings/last-run', { credentials: 'include' }).then(async (r) => {
      if (r.ok) {
        const j = (await r.json()) as { lastRun?: typeof lastRunData }
        if (j.lastRun) setLastRunData(j.lastRun)
      }
    })
  }, [])

  const logLine = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLiveLog((prev) => [...prev.slice(-40), `[${t}] ${msg}`])
    // auto-scroll
    setTimeout(() => {
      if (liveLogRef.current) {
        liveLogRef.current.scrollTop = liveLogRef.current.scrollHeight
      }
    }, 20)
  }, [])

  const fetchPoolState = useCallback(async () => {
    const res = await fetch('/api/pool-state', { cache: 'no-store', credentials: 'include' })
    const j = (await res.json().catch(() => ({}))) as {
      success?: boolean
      unscoredEligible?: unknown
      rawWindow?: unknown
      scoredInWindow?: unknown
      feedMaxAgeDays?: unknown
      rawFetchLimit?: unknown
    }
    if (!res.ok || !j.success) return
    if (
      typeof j.unscoredEligible !== 'number' ||
      typeof j.rawWindow !== 'number' ||
      typeof j.scoredInWindow !== 'number'
    ) {
      return
    }
    const feedMaxAgeDays = typeof j.feedMaxAgeDays === 'number' ? j.feedMaxAgeDays : 7
    const rawFetchLimit = typeof j.rawFetchLimit === 'number' ? j.rawFetchLimit : 400
    setPoolState({
      unscoredEligible: j.unscoredEligible,
      rawWindow: j.rawWindow,
      scoredInWindow: j.scoredInWindow,
      feedMaxAgeDays,
      rawFetchLimit,
    })
  }, [])

  const fetchStories = useCallback(async (): Promise<boolean> => {
    if (pipelineRunningRef.current) {
      return false
    }

    const response = await fetch(`/api/stories?limit=${STORIES_PAGE_SIZE}`, {
      cache: 'no-store',
      credentials: 'include',
    })
    const payload = (await response.json()) as {
      success?: boolean
      stories?: Story[]
      error?: string
      hasMore?: boolean
      nextCursor?: string | null
    }

    if (!response.ok || !payload.success) {
      console.error('Failed to fetch stories:', payload.error ?? response.statusText)
      setLoading(false)
      return false
    }

    setStories((payload.stories as Story[]) ?? [])
    setHasMoreStories(Boolean(payload.hasMore))
    setStoriesNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null)
    setLastUpdated(new Date())
    setLoading(false)
    return true
  }, [])

  const loadMoreStories = useCallback(async () => {
    if (!hasMoreStories || !storiesNextCursor || loadingMoreStories || pipelineRunningRef.current) return
    setLoadingMoreStories(true)
    try {
      const q = new URLSearchParams({
        limit: String(STORIES_PAGE_SIZE),
        cursor: storiesNextCursor,
      })
      const response = await fetch(`/api/stories?${q.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const payload = (await response.json()) as {
        success?: boolean
        stories?: Story[]
        hasMore?: boolean
        nextCursor?: string | null
      }
      if (!response.ok || !payload.success) return
      const next = (payload.stories as Story[]) ?? []
      setStories((prev) => [...prev, ...next])
      setHasMoreStories(Boolean(payload.hasMore))
      setStoriesNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null)
    } finally {
      setLoadingMoreStories(false)
    }
  }, [storiesNextCursor, hasMoreStories, loadingMoreStories])

  const runPipeline = useCallback(async () => {
    if (!canSubmitPipelinePrefs(pipelinePrefs)) return
    if (!hasAnthropicKey) {
      setPipelineMessage('Add your Anthropic API key in Settings first.')
      return
    }

    const last = lastSuccessfulPipelinePrefsRef.current
    const prefsChanged =
      last !== null && stablePipelinePrefsKey(pipelinePrefs) !== stablePipelinePrefsKey(last)

    if (prefsChanged) {
      const proceed = window.confirm(
        'Topic emphasis or focus calibration changed since your last successful scoring run. Re-score the shared story pool with your new settings? This clears your current Signal feed and uses more Anthropic tokens on the next run. Cancel to keep your existing feed without re-scoring.'
      )
      if (!proceed) {
        return
      }
      setPipelineMessage('Clearing previous scores so new settings can apply…')
      const resetRes = await fetch('/api/filter/reset-progress', {
        method: 'POST',
        credentials: 'include',
      })
      if (!resetRes.ok) {
        setPipelineMessage(await readJsonError(resetRes, 'Could not reset scoring progress'))
        return
      }
    }

    pipelineRunningRef.current = true
    setStories([])
    setLiveLog([])
    setPipeSteps(INITIAL_PIPE_STEPS.map((s) => ({ ...s, state: 'pending' as StepState })))
    setRunningPipeline(true)
    setPipelineMessage('Starting…')

    const mark = (index: number, state: StepState) => {
      setPipeSteps((prev) => prev.map((s, i) => (i === index ? { ...s, state } : s)))
    }

    try {
      logLine(`init pipeline — topic: ${pipelinePrefs.topicMode} · scope: ${pipelinePrefs.scope}`)
      logLine(`maxCandidates: ${pipelineRunTuning.maxCandidates} · batchSize: ${pipelineRunTuning.batchSize}`)
      mark(0, 'running')
      setPipelineMessage('Checking pool…')
      logLine('GET /api/pool-state…')
      const before = await fetch('/api/pool-state', { cache: 'no-store', credentials: 'include' })
      const beforePayload = (await before.json().catch(() => ({}))) as {
        success?: boolean
        unscoredEligible?: unknown
      }
      const unscoredEligible =
        before.ok && beforePayload.success && typeof beforePayload.unscoredEligible === 'number'
          ? beforePayload.unscoredEligible
          : null

      if (unscoredEligible === null || unscoredEligible < AUTO_SCRAPE_POOL_FLOOR) {
        const reason = unscoredEligible === null
          ? 'pool state unknown — scraping to be safe'
          : `pool low (${unscoredEligible} ready) — scraping first`
        logLine(reason)
        setPipelineMessage(
          unscoredEligible === null
            ? 'Pool state unknown — scraping to be safe…'
            : `Pool low (${unscoredEligible} ready) — scraping fresh stories first…`
        )
        logLine('POST /api/scrape — fetching RSS + Reddit + HN…')
        const scrape = await fetch('/api/scrape', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: filterRequestBody(pipelinePrefs, pipelineRunTuning),
        })

        if (!scrape.ok) {
          if (scrape.status === 429) {
            logLine('scrape rate-limited — scoring available stories')
            setPipelineMessage('Scrape rate-limited — scoring what’s available…')
          } else {
            throw new Error(await readJsonError(scrape, 'Scrape failed'))
          }
        } else {
          logLine('scrape complete ✓')
          setPipelineMessage('Scrape complete — refreshing pool…')
        }
        await fetchPoolState()
      } else {
        logLine(`pool ok — ${unscoredEligible} unscored stories ready`)
        setPipelineMessage(`${unscoredEligible} stories ready — skipping scrape.`)
      }
      mark(0, 'done')

      mark(1, 'running')
      const budgetCap = pipelineRunTuning.maxCandidates
      const bs = pipelineRunTuning.batchSize
      logLine(
        `POST /api/filter — budget up to ${budgetCap} candidates · batch ${bs} (server uses min(budget, unscored pool); one HTTP = all batches)`
      )
      setPipelineMessage('Step 2 of 3 — scoring with Claude Haiku…')
      const filter = await fetch('/api/filter', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: filterRequestBody(pipelinePrefs, pipelineRunTuning),
      })
      const filterPayload = (await filter.json().catch(() => ({}))) as {
        error?: unknown
        parseWarning?: string
        processed?: number
        stored?: number
        totalInputTokens?: number
        totalOutputTokens?: number
        estimatedCost?: number
        totalBatches?: number
        candidatePoolSize?: number
        candidateCap?: number
        batchSizeUsed?: number
        serverEnvMaxCandidates?: number
      }
      if (!filter.ok) {
        if (filter.status === 429) {
          throw new Error(
            typeof filterPayload.error === 'string'
              ? filterPayload.error
              : 'Filter rate-limited. Please wait before running again.'
          )
        }
        throw new Error(typeof filterPayload.error === 'string' ? filterPayload.error : 'Filter failed')
      }
      mark(1, 'done')
      await fetchPoolState()

      if (
        typeof filterPayload.totalInputTokens === 'number' &&
        typeof filterPayload.totalOutputTokens === 'number'
      ) {
        const inK = (filterPayload.totalInputTokens / 1000).toFixed(1)
        const outK = (filterPayload.totalOutputTokens / 1000).toFixed(1)
        const batches = filterPayload.totalBatches ?? 0
        const pool = filterPayload.candidatePoolSize ?? 0
        const cap = filterPayload.candidateCap ?? budgetCap
        const batchUsed = filterPayload.batchSizeUsed ?? bs
        logLine(
          `scoring complete \u2713 \u2014 ${pool} candidates scored (${cap} cap, ${batchUsed}/batch) \u2192 ${batches} Haiku batch${batches === 1 ? '' : 'es'}`
        )
        if (pool < cap * 0.75) {
          logLine(`pool was smaller than your budget — scrape fresh or widen age window to spend more on Deep`)
        }
        const srvMax = filterPayload.serverEnvMaxCandidates
        if (typeof srvMax === 'number' && budgetCap > srvMax) {
          logLine(
            `server ceiling is ${srvMax} (FILTER_MAX_CANDIDATES on host) — UI asked for ${budgetCap}; add or raise that env in Vercel to match Deep`
          )
        }
        logLine(`tokens: ${inK}K in / ${outK}K out \u2014 est. $${(filterPayload.estimatedCost ?? 0).toFixed(4)}`)
        logLine(`stored ${filterPayload.stored ?? 0} stories to your feed`)
        setLastRunStats({
          inputTokens: filterPayload.totalInputTokens,
          outputTokens: filterPayload.totalOutputTokens,
          estimatedCost: filterPayload.estimatedCost ?? 0,
          stored: filterPayload.stored ?? 0,
          batches: filterPayload.totalBatches ?? 0,
          candidatePoolSize: pool,
          candidateCap: cap,
          batchSizeUsed: batchUsed,
          serverEnvMaxCandidates: filterPayload.serverEnvMaxCandidates ?? cap,
        })
        setLastRunData({
          run_at: new Date().toISOString(),
          input_tokens: filterPayload.totalInputTokens,
          output_tokens: filterPayload.totalOutputTokens,
          estimated_cost: filterPayload.estimatedCost ?? 0,
          stories_scored: filterPayload.processed ?? null,
        })
      }

      pipelineRunningRef.current = false
      mark(2, 'running')
      logLine('loading feed from database\u2026')
      setPipelineMessage('Step 3 of 3 \u2014 loading stories\u2026')
      const ok = await fetchStories()
      if (!ok) throw new Error('Stories fetch failed')
      mark(2, 'done')
      logLine('pipeline complete \u2713')

      const batchNote =
        typeof filterPayload.totalBatches === 'number' && filterPayload.totalBatches > 0
          ? ` (${filterPayload.totalBatches} batch${filterPayload.totalBatches === 1 ? '' : 'es'})`
          : ''
      setPipelineMessage(
        typeof filterPayload.parseWarning === 'string'
          ? `Feed updated${batchNote}. Note: ${filterPayload.parseWarning}`
          : `Feed updated${batchNote}.`
      )

      lastSuccessfulPipelinePrefsRef.current = {
        topicMode: pipelinePrefs.topicMode,
        topicCustom: pipelinePrefs.topicMode === 'other' ? pipelinePrefs.topicCustom : '',
        scope: pipelinePrefs.scope,
      }
    } catch (err) {
      console.error(err)
      setPipelineMessage(
        err instanceof Error ? err.message : 'Pipeline failed. Check API logs or try Refresh Feed.'
      )
      setPipeSteps((prev) => {
        const next = prev.map((s) => ({ ...s }))
        const ri = next.findIndex((s) => s.state === 'running')
        if (ri >= 0) next[ri] = { ...next[ri], state: 'error' }
        return next
      })
      setStories([])
    } finally {
      pipelineRunningRef.current = false
      setRunningPipeline(false)
    }
  }, [fetchStories, fetchPoolState, pipelinePrefs, pipelineRunTuning, hasAnthropicKey, logLine])

  const scrapeFresh = useCallback(async () => {
    if (scrapingFresh || runningPipeline) return
    setScrapingFresh(true)
    setPipelineMessage('Scraping all preset sources (not limited to your topic)…')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSources: true }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        inserted?: number
        total_collected?: number
        error?: string
        fullSources?: boolean
      }
      if (!res.ok) {
        setPipelineMessage(
          res.status === 429
            ? 'Scrape rate-limited — wait 2 min between scrapes.'
            : (typeof j.error === 'string' ? j.error : 'Scrape failed.')
        )
      } else {
        const mode = j.fullSources ? 'All preset RSS, Reddit, and HN packs. ' : ''
        setPipelineMessage(
          `${mode}Collected ${j.total_collected ?? 0}, ${j.inserted ?? 0} new in the pool.`
        )
        await fetchPoolState()
      }
    } catch {
      setPipelineMessage('Scrape failed — check logs.')
    } finally {
      setScrapingFresh(false)
    }
  }, [scrapingFresh, runningPipeline, fetchPoolState])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchStories()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchStories])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchPoolState()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchPoolState])

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchStories()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchStories])

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchPoolState()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchPoolState])

  const counts: Record<Category, number> = {
    all: stories.length,
    opportunity: stories.filter((s) => s.category === 'opportunity').length,
    idea: stories.filter((s) => s.category === 'idea').length,
    intel: stories.filter((s) => s.category === 'intel').length,
  }

  const filtered =
    category === 'all' ? stories : stories.filter((s) => s.category === category)

  const showPipelineDetail =
    runningPipeline || pipeSteps.some((s) => s.state === 'done' || s.state === 'error')

  const prefsOk = canSubmitPipelinePrefs(pipelinePrefs)
  const canRun = prefsOk && hasAnthropicKey
  const showFeedSection = !runningPipeline

  return (
    <main className="signal-wrdlss-shell signal-hero-bg">
      {/* Pending: black cover prevents feed flash until sessionStorage is checked */}
      {introState === 'pending' && <div className="fixed inset-0 z-50 bg-black" />}
      {introState === 'show' && <FeedIntro onDone={handleIntroDone} />}
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 md:px-8">
        <header className="sticky top-5 z-20 mb-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/45 px-5 py-3 text-zinc-100 backdrop-blur-xl">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
            Dev Signal
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runPipeline}
              disabled={runningPipeline || scrapingFresh || !canRun}
              title={
                !hasAnthropicKey
                  ? 'Add your Anthropic key in Settings'
                  : !prefsOk
                    ? 'Add a custom topic or choose a preset'
                    : undefined
              }
              className="rounded-full border border-white/20 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningPipeline ? 'Running...' : 'Run Pipeline'}
            </button>
            <button
              onClick={() => void scrapeFresh()}
              disabled={scrapingFresh || runningPipeline}
              title="Scrape every preset RSS feed, subreddit pack, and HN query at once (ignores topic selection). Rate-limited."
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scrapingFresh ? 'Scraping…' : 'Scrape Fresh'}
            </button>
            <Link
              href="/settings"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              Settings
            </Link>
          </div>
        </header>

        {/* ── Stat chips ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/50 px-5 py-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Stories</p>
            <p className="mt-2 font-mono text-4xl font-bold text-zinc-50">{loading ? '—' : stories.length}</p>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">{STAT_CHIP_HELP.stories}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 px-5 py-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Opportunities</p>
            <p className="mt-2 font-mono text-4xl font-bold text-emerald-400">{loading ? '—' : counts.opportunity}</p>
            <p className="mt-1 text-[11px] leading-snug text-emerald-800/90">{STAT_CHIP_HELP.opportunities}</p>
          </div>
          <div className="rounded-2xl border border-sky-500/25 bg-sky-950/25 px-5 py-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-sky-700">Ideas</p>
            <p className="mt-2 font-mono text-4xl font-bold text-sky-400">{loading ? '—' : counts.idea}</p>
            <p className="mt-1 text-[11px] leading-snug text-sky-800/90">{STAT_CHIP_HELP.ideas}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/50 px-5 py-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Intel</p>
            <p className="mt-2 font-mono text-4xl font-bold text-zinc-300">{loading ? '—' : counts.intel}</p>
            <p className="mt-1 text-[11px] leading-snug text-zinc-500">{STAT_CHIP_HELP.intel}</p>
          </div>
        </div>

        {/* ── Pipeline prefs + Last run ── */}
        <div className="mt-3 grid gap-3 md:grid-cols-2 md:items-start">
          {/* Pipeline preferences */}
          <div className="rounded-2xl border border-white/10 bg-black/50 p-5 text-zinc-100 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Pipeline</p>
            <div className="mt-3">
              <PipelinePreferencesPanel
                value={pipelinePrefs}
                onChange={setPipelinePrefs}
                runTuning={pipelineRunTuning}
                onRunTuningChange={setPipelineRunTuning}
                disabled={runningPipeline}
              />
            </div>
            {!hasAnthropicKey && (
              <p className="mt-3 rounded-xl border border-amber-400/35 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                Add your Anthropic API key in{' '}
                <Link href="/settings" className="font-medium text-white underline underline-offset-2">
                  Settings
                </Link>{' '}
                to run the scoring pipeline.
              </p>
            )}
            <div className="mt-3 border-t border-white/8 pt-3">
              <p className="font-mono text-xs leading-snug text-zinc-400">{pipelineMessage}</p>
              {showPipelineDetail && (
                <div className="mt-2">
                  <PipelineProgress steps={pipeSteps} />
                </div>
              )}
            </div>
          </div>

          {/* Last run analysis */}
          <div className="rounded-2xl border border-white/10 bg-black/50 p-5 text-zinc-100 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Last run</p>
            {lastRunData ? (
              <>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                  {new Date(lastRunData.run_at).toLocaleString()}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Scored</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">
                      {lastRunData.stories_scored?.toLocaleString() ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-800">Est. cost</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
                      {lastRunData.estimated_cost != null
                        ? `$${Number(lastRunData.estimated_cost).toFixed(4)}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Input tokens</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {lastRunData.input_tokens != null ? `${(lastRunData.input_tokens / 1000).toFixed(1)}K` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Output tokens</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {lastRunData.output_tokens != null ? `${(lastRunData.output_tokens / 1000).toFixed(1)}K` : '—'}
                    </span>
                  </div>
                  {lastRunStats && (
                    <>
                      <div className="h-px bg-white/5" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Stored to feed</span>
                        <span className="font-mono text-xs text-zinc-400">{lastRunStats.stored}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Batches run</span>
                        <span className="font-mono text-xs text-zinc-400">{lastRunStats.batches}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Candidates (actual / cap)</span>
                        <span className="font-mono text-xs text-zinc-400">
                          {lastRunStats.candidatePoolSize} / {lastRunStats.candidateCap}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Batch size used</span>
                        <span className="font-mono text-xs text-zinc-400">{lastRunStats.batchSizeUsed}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Host max (FILTER_MAX_CANDIDATES)</span>
                        <span className="font-mono text-xs text-zinc-400">
                          {lastRunStats.serverEnvMaxCandidates}
                        </span>
                      </div>
                    </>
                  )}
                  {poolState && (
                    <>
                      <div className="h-px bg-white/5" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Shared raw pool</span>
                        <span className="font-mono text-xs text-zinc-400">
                          {poolState.rawWindow.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Unscored for you</span>
                        <span className="font-mono text-xs text-zinc-400">
                          {poolState.unscoredEligible.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug text-zinc-600">
                        Pool rules: published ≤ {poolState.feedMaxAgeDays}d when dated · newest{' '}
                        {poolState.rawFetchLimit.toLocaleString()} by scrape time (same as scoring).
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-5 text-center">
                <p className="font-mono text-3xl text-zinc-700">—</p>
                <p className="mt-2 text-sm text-zinc-500">No runs yet. Hit Run Pipeline to start.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Terminals ── */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {/* static config */}
          <div className="rounded-2xl border border-emerald-500/35 bg-black p-4 font-mono text-xs text-emerald-300">
            <p className="mb-2 text-emerald-400">signal://pipeline-config</p>
            <div className="space-y-1">
              {TERMINAL_LINES.map((line) => (
                <p key={line}>&gt; {line}</p>
              ))}
            </div>
            <p className="mt-2 text-emerald-200/80">
              &gt; status: {pipelineMessage}
              <span className="signal-caret">|</span>
            </p>
          </div>

          {/* live log */}
          <div className="flex flex-col rounded-2xl border border-zinc-700/50 bg-black p-4 font-mono text-xs text-zinc-300">
            <p className="mb-2 flex items-center gap-2 text-zinc-400">
              signal://live-log
              {runningPipeline && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              )}
            </p>
            <div
              ref={liveLogRef}
              className="flex-1 space-y-0.5 overflow-y-auto"
              style={{ maxHeight: '9rem' }}
            >
              {liveLog.map((line, i) => (
                <p
                  key={i}
                  className={i === liveLog.length - 1 && runningPipeline ? 'text-emerald-300' : 'text-zinc-400'}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {showFeedSection ? (
          <>
            <section className="mt-3 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
              <CategoryFilter active={category} onChange={setCategory} counts={counts} />
            </section>

            <section className="mt-3 space-y-3">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-32 animate-pulse rounded-2xl border border-white/10 bg-zinc-950/35"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/55 py-16 text-center text-zinc-400 backdrop-blur-md">
                  <p className="mb-3 text-4xl">📡</p>
                  <p className="font-medium text-zinc-100">No stories yet</p>
                  <p className="mt-1 text-sm text-zinc-500">Run the pipeline to score and load stories.</p>
                  <button
                    onClick={runPipeline}
                    disabled={runningPipeline || !canRun}
                    className="mt-5 rounded-lg border border-white/20 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {runningPipeline ? 'Running...' : 'Run now'}
                  </button>
                </div>
              ) : (
                <>
                  {filtered.map((story) => (
                    <FeedCard key={story.id} story={story} />
                  ))}
                  {hasMoreStories && filtered.length > 0 ? (
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        onClick={() => void loadMoreStories()}
                        disabled={loadingMoreStories}
                        className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingMoreStories ? 'Loading…' : 'Load more stories'}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </>
        ) : (
          <section className="mt-3 rounded-2xl border border-white/10 bg-black/50 py-12 text-center text-zinc-400 backdrop-blur-md">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Pipeline running</p>
            <p className="mt-2 text-sm font-medium text-zinc-100">Scoring stories — feed will reload when done</p>
          </section>
        )}
      </div>
    </main>
  )
}
