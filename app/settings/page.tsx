'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { REDDIT_BASE, RSS_FEEDS_BASE } from '@/lib/scrape-sources'

type LastRunPayload = {
  run_at: string
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost: number | string | null
  stories_scored: number | null
} | null

function formatUsd4(n: number | string | null | undefined): string {
  const x = typeof n === 'string' ? Number.parseFloat(n) : typeof n === 'number' ? n : Number.NaN
  if (!Number.isFinite(x)) return '$0.0000'
  return `$${x.toFixed(4)}`
}

function mapTestKeyError(error: string): string {
  switch (error) {
    case 'verify_email_first':
      return 'Verify your email first.'
    case 'add_key_first':
      return 'Save an API key first.'
    default:
      return error
  }
}

function mapSynthErrorKey(error: string, detail?: string): string {
  switch (error) {
    case 'add_key_first':
      return 'Add your Anthropic API key in Settings first.'
    case 'verify_email_first':
      return 'Verify your email before re-running synthesis.'
    case 'missing_profile_model':
      return 'Profile synthesis is not configured on the server (missing ANTHROPIC_PROFILE_MODEL).'
    case 'synthesis_failed':
      return 'Synthesis did not produce a valid profile. Try again or update your answers in Onboarding.'
    case 'synthesis_request_failed':
      return 'Could not reach Anthropic. Check your key and try again.'
    case 'invalid_answers':
      return detail ? `Invalid questionnaire data: ${detail}` : 'Stored questionnaire answers are invalid. Re-do onboarding.'
    default:
      return error
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [testingKey, setTestingKey] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [scoringMd, setScoringMd] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<unknown>(null)
  const [lastRun, setLastRun] = useState<LastRunPayload>(null)
  const [lastRunLoading, setLastRunLoading] = useState(true)
  const [synthesizing, setSynthesizing] = useState(false)
  const [synthMessage, setSynthMessage] = useState('')
  const [resettingProgress, setResettingProgress] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  useEffect(() => {
    void (async () => {
      const [stRes, prRes, lrRes] = await Promise.all([
        fetch('/api/settings/status', { credentials: 'include' }),
        fetch('/api/settings/profile', { credentials: 'include' }),
        fetch('/api/settings/last-run', { credentials: 'include' }),
      ])

      if (stRes.status === 401) {
        router.replace('/login?redirect=/settings')
        return
      }

      const data = await stRes.json().catch(() => ({}))
      setHasKey(Boolean((data as { hasAnthropicKey?: boolean }).hasAnthropicKey))

      if (prRes.ok) {
        const pj = (await prRes.json()) as {
          scoring_markdown?: string | null
          questionnaire_answers?: unknown
        }
        setScoringMd(typeof pj.scoring_markdown === 'string' ? pj.scoring_markdown : '')
        setQuestionnaireAnswers(
          pj.questionnaire_answers !== undefined && pj.questionnaire_answers !== null
            ? pj.questionnaire_answers
            : null
        )
      }
      setProfileLoading(false)

      if (lrRes.ok) {
        const lj = (await lrRes.json()) as { lastRun?: LastRunPayload }
        setLastRun(lj.lastRun ?? null)
      } else {
        setLastRun(null)
      }
      setLastRunLoading(false)
      setLoading(false)
    })()
  }, [router])

  async function saveKey(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setSaving(true)
    const res = await fetch('/api/settings/anthropic', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Could not save key')
      return
    }
    setHasKey(true)
    setApiKey('')
    setMessage('Saved. Your key is encrypted and only used server-side when you run the filter.')
    const st = await fetch('/api/settings/status', { credentials: 'include' }).then((r) => r.json())
    const hasProfile = Boolean(st.hasScoringProfile ?? st.onboardingCompleted)
    if (!hasProfile) {
      window.location.assign('/onboarding')
    } else {
      window.location.assign('/feed')
    }
  }

  async function saveProfileMd(e: React.FormEvent) {
    e.preventDefault()
    setProfileMessage('')
    if (scoringMd.length > 4000) {
      setProfileMessage('Scoring profile must be at most 4000 characters.')
      return
    }
    setProfileSaving(true)
    const res = await fetch('/api/settings/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scoring_markdown: scoringMd }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    setProfileSaving(false)
    if (!res.ok) {
      setProfileMessage(typeof data.error === 'string' ? data.error : 'Could not save profile')
      return
    }
    if (data && typeof data === 'object' && 'ok' in data && data.ok === true) {
      setProfileMessage('Saved')
    } else {
      setProfileMessage('Could not save profile')
    }
  }

  async function removeKey() {
    setMessage('')
    setTestMessage('')
    const res = await fetch('/api/settings/anthropic', { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setHasKey(false)
      setMessage('Key removed.')
    }
  }

  async function testAnthropicKey() {
    setTestMessage('')
    setTestingKey(true)
    try {
      const res = await fetch('/api/settings/anthropic/test', { credentials: 'include' })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.ok && j.ok === true) {
        setTestMessage('Key valid')
        return
      }
      setTestMessage(
        typeof j.error === 'string' ? mapTestKeyError(j.error) : 'Key test failed'
      )
    } finally {
      setTestingKey(false)
    }
  }

  async function redoQuestionnaireSynthesis() {
    setSynthMessage('')
    if (questionnaireAnswers === null || typeof questionnaireAnswers !== 'object') {
      setSynthMessage('No saved questionnaire answers. Complete onboarding first.')
      return
    }
    setSynthesizing(true)
    try {
      const res = await fetch('/api/onboarding/synthesize-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionnaireAnswers),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        detail?: string
        scoring_markdown?: string
      }
      if (!res.ok) {
        const key = typeof j.error === 'string' ? j.error : 'Request failed'
        setSynthMessage(mapSynthErrorKey(key, typeof j.detail === 'string' ? j.detail : undefined))
        return
      }
      const pr = await fetch('/api/settings/profile', { credentials: 'include' })
      if (pr.ok) {
        const pj = (await pr.json()) as { scoring_markdown?: string | null }
        setScoringMd(typeof pj.scoring_markdown === 'string' ? pj.scoring_markdown : '')
      } else if (typeof j.scoring_markdown === 'string') {
        setScoringMd(j.scoring_markdown)
      }
      setSynthMessage('Profile re-synthesized. Review the scoring profile above and save if you edit it.')
    } finally {
      setSynthesizing(false)
    }
  }

  async function resetScoringProgress() {
    setResetMessage('')
    if (!hasKey) return
    if (
      !window.confirm(
        'Clear your scoring progress? Your feed will empty until you run the pipeline again; the next run will re-score shared stories with your current topic and scope settings.'
      )
    ) {
      return
    }
    setResettingProgress(true)
    try {
      const res = await fetch('/api/filter/reset-progress', { method: 'POST', credentials: 'include' })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setResetMessage(typeof j.error === 'string' ? j.error : 'Could not reset progress')
        return
      }
      setResetMessage('Scoring progress cleared. Run the pipeline from the feed when you are ready.')
    } finally {
      setResettingProgress(false)
    }
  }

  const canRedoSynthesis =
    questionnaireAnswers !== null && questionnaireAnswers !== undefined && typeof questionnaireAnswers === 'object'

  if (loading) {
    return (
      <main className="signal-wrdlss-shell signal-hero-bg flex min-h-full items-center justify-center px-5 py-16">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    )
  }

  return (
    <main className="signal-wrdlss-shell signal-hero-bg px-5 py-12 md:py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-black/70 p-8 text-zinc-100 shadow-xl backdrop-blur-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Settings</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-zinc-50">Anthropic API key</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Bring your own key (BYOK). It is encrypted before storage and only decrypted on the server when
          you run the scoring step.{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline hover:text-zinc-200"
          >
            Get a key
          </a>
        </p>

        {hasKey ? (
          <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            A key is on file. Paste a new one below to replace it.
          </p>
        ) : null}

        <form onSubmit={saveKey} className="mt-6 space-y-4">
          <div>
            <label htmlFor="key" className="block font-mono text-xs text-zinc-400">
              API key
            </label>
            <input
              id="key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/35"
              placeholder="sk-ant-api03-…"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="w-full rounded-xl border border-white/20 bg-white py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {saving ? 'Saving…' : hasKey ? 'Replace key' : 'Save key'}
          </button>
        </form>

        {hasKey ? (
          <button
            type="button"
            onClick={() => void removeKey()}
            className="mt-3 w-full rounded-xl border border-white/15 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            Remove key
          </button>
        ) : null}

        {hasKey ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={testingKey}
              onClick={() => void testAnthropicKey()}
              className="w-full rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:opacity-60"
            >
              {testingKey ? 'Testing…' : 'Test key'}
            </button>
            {testMessage ? (
              <p
                className={`mt-2 text-sm ${testMessage === 'Key valid' ? 'text-emerald-300' : 'text-red-400'}`}
              >
                {testMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="mt-4 text-sm text-zinc-400">{message}</p> : null}

        <div className="mt-10 border-t border-white/10 pt-8">
          <h2 className="font-serif text-xl text-zinc-50">Sources</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Default scrape pool: {RSS_FEEDS_BASE.length} RSS feeds · {REDDIT_BASE.length} subreddits · 1 HN query
            (Algolia search).
          </p>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <h2 className="font-serif text-xl text-zinc-50">Last run summary</h2>
          <p className="mt-1 text-sm text-zinc-400">Most recent logged Claude usage (filter or profile synthesis).</p>
          {lastRunLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Loading…</p>
          ) : lastRun ? (
            <dl className="mt-4 space-y-2 font-mono text-xs text-zinc-300">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">When</dt>
                <dd>{new Date(lastRun.run_at).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Input tokens</dt>
                <dd>{(lastRun.input_tokens ?? 0).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Output tokens</dt>
                <dd>{(lastRun.output_tokens ?? 0).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Est. cost</dt>
                <dd>{formatUsd4(lastRun.estimated_cost)}</dd>
              </div>
              {typeof lastRun.stories_scored === 'number' ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Stories scored</dt>
                  <dd>{lastRun.stories_scored.toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No pipeline runs yet</p>
          )}
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <h2 className="font-serif text-xl text-zinc-50">Scoring profile (markdown)</h2>
          <p className="mt-1 text-sm text-zinc-400">
            This text is what Claude Haiku sees when scoring your feed (max 4000 characters). You can tune it after
            onboarding.
          </p>
          {profileLoading ? (
            <p className="mt-4 text-sm text-zinc-500">Loading profile…</p>
          ) : (
            <form onSubmit={saveProfileMd} className="mt-4 space-y-3">
              <textarea
                value={scoringMd}
                onChange={(e) => setScoringMd(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-white/35"
                placeholder="# Signal Profile …"
              />
              <div className="flex items-center justify-between gap-3">
                <span className={`text-xs ${scoringMd.length > 4000 ? 'text-amber-300' : 'text-zinc-500'}`}>
                  {scoringMd.length} / 4000
                </span>
                <button
                  type="submit"
                  disabled={profileSaving || scoringMd.length > 4000}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/15 disabled:opacity-50"
                >
                  {profileSaving ? 'Saving…' : 'Save scoring profile'}
                </button>
              </div>
              {scoringMd.length > 4000 ? (
                <p className="text-sm text-amber-200">Scoring profile must be at most 4000 characters before you can save.</p>
              ) : null}
              {profileMessage ? <p className="text-sm text-zinc-400">{profileMessage}</p> : null}
            </form>
          )}
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <h2 className="font-serif text-xl text-zinc-50">Redo questionnaire</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Re-run Sonnet synthesis using your saved onboarding answers. Updates the scoring profile text above.
          </p>
          {!canRedoSynthesis ? (
            <p className="mt-4 text-sm text-zinc-500">
              No saved questionnaire on file.{' '}
              <Link href="/onboarding" className="text-white underline hover:text-zinc-200">
                Complete onboarding
              </Link>{' '}
              to enable this.
            </p>
          ) : (
            <button
              type="button"
              disabled={synthesizing}
              onClick={() => void redoQuestionnaireSynthesis()}
              className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-white/15 disabled:opacity-50"
            >
              {synthesizing ? 'Synthesizing…' : 'Re-run profile synthesis'}
            </button>
          )}
          {synthMessage ? <p className="mt-3 text-sm text-zinc-400">{synthMessage}</p> : null}
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <div className="rounded-2xl border-2 border-red-500/50 bg-red-950/20 p-6">
            <h2 className="font-serif text-xl text-red-300">Danger zone</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Resetting clears your scored stories and scoring marks. Your feed stays empty until you run the pipeline
              again from the live feed.
            </p>
            <button
              type="button"
              disabled={resettingProgress || !hasKey}
              onClick={() => void resetScoringProgress()}
              className="mt-4 rounded-lg border border-red-500/60 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resettingProgress ? 'Resetting…' : 'Reset scoring progress'}
            </button>
            {resetMessage ? <p className="mt-3 text-sm text-zinc-400">{resetMessage}</p> : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/feed" className="font-medium text-white underline hover:text-zinc-200">
            Open live feed
          </Link>
          <button
            type="button"
            className="ml-auto text-zinc-500 hover:text-zinc-200"
            onClick={() => {
              void createSupabaseBrowserClient().auth.signOut().then(() => router.replace('/'))
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
