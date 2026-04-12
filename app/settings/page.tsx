'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [scoringMd, setScoringMd] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/settings/status', { credentials: 'include' })
      if (res.status === 401) {
        router.replace('/login?redirect=/settings')
        return
      }
      const data = await res.json()
      setHasKey(Boolean(data.hasAnthropicKey))
      setLoading(false)
      const pr = await fetch('/api/settings/profile', { credentials: 'include' })
      if (pr.ok) {
        const pj = (await pr.json()) as { scoring_markdown?: string | null }
        setScoringMd(typeof pj.scoring_markdown === 'string' ? pj.scoring_markdown : '')
      }
      setProfileLoading(false)
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
    const res = await fetch('/api/settings/anthropic', { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setHasKey(false)
      setMessage('Key removed.')
    }
  }

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

        {message ? <p className="mt-4 text-sm text-zinc-400">{message}</p> : null}

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
