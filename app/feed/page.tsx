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
  type PipelineRunTuning,
} from '@/lib/pipeline-preferences'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000
const STORIES_PAGE_SIZE = 25

const TERMINAL_LINES = [
  'watcher/rss          connected (22 sources)',
  'watcher/reddit       connected (11 subreddits)',
  'watcher/hn           connected (front-page stream)',
  'pipeline/filter      scoring batches 2× parallel via claude-haiku-4-5',
  'pipeline/storage     upserting scored stories',
  'alerts/opportunity   evaluating score >= 8 signals',
]

const INITIAL_PIPE_STEPS = [
  { label: 'Collect RSS, Reddit & Hacker News', state: 'pending' as StepState },
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
  const [stories, setStories] = useState<Story[]>([])
  const [category, setCategory] = useState<Category>('all')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [runningPipeline, setRunningPipeline] = useState(false)
  const [pipelineMessage, setPipelineMessage] = useState('Control room online.')
  const [pipeSteps, setPipeSteps] = useState(INITIAL_PIPE_STEPS)
  const [pipelinePrefs, setPipelinePrefs] = useState<PipelinePreferences>(DEFAULT_PIPELINE_PREFS)
  const [pipelineRunTuning, setPipelineRunTuning] = useState<PipelineRunTuning>(DEFAULT_PIPELINE_RUN_TUNING)
  const [lastRunStats, setLastRunStats] = useState<{
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    stored: number
    batches: number
  } | null>(null)
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [resettingProgress, setResettingProgress] = useState(false)
  const [hasMoreStories, setHasMoreStories] = useState(false)
  const [storiesNextCursor, setStoriesNextCursor] = useState<string | null>(null)
  const [loadingMoreStories, setLoadingMoreStories] = useState(false)
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
    setPipeSteps(INITIAL_PIPE_STEPS.map((s) => ({ ...s, state: 'pending' as StepState })))
    setRunningPipeline(true)
    setPipelineMessage('Starting…')

    const mark = (index: number, state: StepState) => {
      setPipeSteps((prev) => prev.map((s, i) => (i === index ? { ...s, state } : s)))
    }

    try {
      mark(0, 'running')
      setPipelineMessage('Step 1 of 3 — collecting from RSS, Reddit, and HN (sources widen by topic)…')
      const scrape = await fetch('/api/scrape', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: filterRequestBody(pipelinePrefs, pipelineRunTuning),
      })
      if (!scrape.ok) {
        throw new Error(await readJsonError(scrape, 'Scrape failed'))
      }
      mark(0, 'done')

      mark(1, 'running')
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
      }
      if (!filter.ok) {
        throw new Error(typeof filterPayload.error === 'string' ? filterPayload.error : 'Filter failed')
      }
      mark(1, 'done')

      if (
        typeof filterPayload.totalInputTokens === 'number' &&
        typeof filterPayload.totalOutputTokens === 'number'
      ) {
        setLastRunStats({
          inputTokens: filterPayload.totalInputTokens,
          outputTokens: filterPayload.totalOutputTokens,
          estimatedCost: filterPayload.estimatedCost ?? 0,
          stored: filterPayload.stored ?? 0,
          batches: filterPayload.totalBatches ?? 0,
        })
      }

      pipelineRunningRef.current = false
      mark(2, 'running')
      setPipelineMessage('Step 3 of 3 — loading stories…')
      const ok = await fetchStories()
      if (!ok) throw new Error('Stories fetch failed')
      mark(2, 'done')

      const batchNote =
        typeof filterPayload.totalBatches === 'number' && filterPayload.totalBatches > 0
          ? ` (${filterPayload.totalBatches} batch${filterPayload.totalBatches === 1 ? '' : 'es'})`
          : ''
      setPipelineMessage(
        typeof filterPayload.parseWarning === 'string'
          ? `Control room synced${batchNote}. Note: ${filterPayload.parseWarning}`
          : `Control room synced${batchNote}.`
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
  }, [fetchStories, pipelinePrefs, pipelineRunTuning, hasAnthropicKey])

  const resetScoringProgress = useCallback(async () => {
    if (!hasAnthropicKey || runningPipeline || resettingProgress) return
    if (
      !window.confirm(
        'Clear your scoring progress? Your feed will empty until you run the pipeline again; the next run will re-score shared stories with your current topic and scope settings.'
      )
    ) {
      return
    }
    setResettingProgress(true)
    setPipelineMessage('Clearing scoring progress…')
    try {
      const res = await fetch('/api/filter/reset-progress', { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        const msg = await readJsonError(res, 'Could not reset progress')
        setPipelineMessage(msg)
        return
      }
      setStories([])
      setPipelineMessage('Scoring progress cleared. Run pipeline to re-score with your preferences.')
      void fetchStories()
    } finally {
      setResettingProgress(false)
    }
  }, [hasAnthropicKey, runningPipeline, resettingProgress, fetchStories])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchStories()
    }, 0)
    return () => clearTimeout(id)
  }, [fetchStories])

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchStories()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchStories])

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
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-5 md:px-8">
        <header className="sticky top-5 z-20 mb-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/45 px-5 py-3 text-zinc-100 backdrop-blur-xl">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-white">
            Signal
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runPipeline}
              disabled={runningPipeline || !canRun}
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
              onClick={() => void fetchStories()}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              Refresh Feed
            </button>
            <Link
              href="/settings"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              Settings
            </Link>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-start">
          <div className="signal-section rounded-3xl border border-white/10 bg-black/50 p-7 text-zinc-100 backdrop-blur-md">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Live Feed Control Room
            </p>
            <h1 className="font-serif text-5xl leading-[0.95] text-zinc-50 md:text-6xl">
              Real-time signal stream
            </h1>
            <p className="mt-4 max-w-xl text-lg text-zinc-400">
              Monitoring RSS, Reddit, and Hacker News through the filter pipeline and opportunity alerts in one
              place.
            </p>

            <div className="mt-6">
              <PipelinePreferencesPanel
                value={pipelinePrefs}
                onChange={setPipelinePrefs}
                runTuning={pipelineRunTuning}
                onRunTuningChange={setPipelineRunTuning}
                disabled={runningPipeline}
              />
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void resetScoringProgress()}
                  disabled={runningPipeline || resettingProgress || !hasAnthropicKey}
                  className="rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resettingProgress ? 'Resetting…' : 'Reset scoring progress'}
                </button>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Clears your feed and scoring marks so the next run re-scores the pool. Usually unnecessary —
                  Run Pipeline already prompts when topic or scope changed.
                </p>
              </div>
            </div>

            {!hasAnthropicKey && (
              <p className="mt-4 rounded-xl border border-amber-400/35 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                Add your Anthropic API key in{' '}
                <Link href="/settings" className="font-medium text-white underline underline-offset-2">
                  Settings
                </Link>{' '}
                to run the scoring pipeline (BYOK — your key, your usage).
              </p>
            )}

            <div className="mt-4">
              <p className="font-mono text-xs leading-snug text-zinc-400">{pipelineMessage}</p>
              {showPipelineDetail && (
                <div className="mt-2">
                  <PipelineProgress steps={pipeSteps} />
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-500/35 bg-black p-4 font-mono text-xs text-emerald-300">
              <p className="mb-2 text-emerald-400">terminal://signal-control</p>
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
          </div>

          <div className="signal-section rounded-3xl border border-white/10 bg-black/50 p-7 text-zinc-100 backdrop-blur-md">
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-sm text-zinc-500">Stories loaded</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-50">{stories.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-sm text-zinc-500">Last update</p>
                <p className="mt-1 text-lg font-semibold text-zinc-50">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Loading...'}
                </p>
              </div>
              {lastRunStats ? (
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    Last run tokens
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Input</span>
                      <span className="font-medium text-zinc-200">
                        {lastRunStats.inputTokens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Output</span>
                      <span className="font-medium text-zinc-200">
                        {lastRunStats.outputTokens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Est. cost</span>
                      <span className="font-medium text-zinc-200">
                        ${lastRunStats.estimatedCost.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1.5">
                      <span className="text-zinc-500">Stored</span>
                      <span className="font-medium text-zinc-200">{lastRunStats.stored} stories</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {showFeedSection ? (
          <>
            <section className="signal-section mt-8 rounded-3xl border border-white/10 bg-black/50 p-4 backdrop-blur-md md:p-6">
              <CategoryFilter active={category} onChange={setCategory} counts={counts} />
            </section>

            <section className="mt-6 space-y-4">
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
                  <p className="mt-1 text-sm text-zinc-500">Run pipeline to populate the live feed.</p>
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
                    <div className="flex justify-center pt-6">
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
          <section className="signal-section mt-8 rounded-3xl border border-white/10 bg-black/50 p-10 text-center text-zinc-400 backdrop-blur-md">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Pipeline active</p>
            <p className="mt-3 text-lg font-medium text-zinc-100">Refreshing your feed…</p>
            <p className="mt-2 mx-auto max-w-md text-sm text-zinc-500">
              Stories stay hidden until collection, scoring, and reload finish so you don’t see stale cards
              mixed with a run in progress.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
