'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { QuestionnaireAnswers } from '@/lib/questionnaire'

const MAX_FREE = 1000

const Q1_OPTIONS = [
  { value: 'building', label: 'Building' },
  { value: 'trading_investing', label: 'Trading / investing' },
  { value: 'research', label: 'Research' },
  { value: 'learning_career', label: 'Learning / career' },
  { value: 'open_source', label: 'Open source' },
] as const

const Q2_OPTIONS = [
  { value: 'under_6mo', label: 'Under 6 months' },
  { value: '6mo_1yr', label: '6 months – 1 year' },
  { value: '1_3yr', label: '1–3 years' },
  { value: '3_5yr', label: '3–5 years' },
  { value: '5yr_plus', label: '5+ years' },
] as const

const Q3_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'under_6mo', label: 'Under 6 months' },
  { value: '6mo_1yr', label: '6 months – 1 year' },
  { value: '1_3yr', label: '1–3 years' },
  { value: '3yr_plus', label: '3+ years' },
] as const

const Q5_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'l2s', label: 'L2s (Arbitrum/Base/Optimism)' },
  { value: 'solana', label: 'Solana' },
  { value: 'bitcoin_lightning', label: 'Bitcoin / Lightning' },
  { value: 'multichain', label: 'Multi-chain' },
  { value: 'claude_anthropic_apis', label: 'Claude / Anthropic APIs' },
  { value: 'oss_llms', label: 'OSS LLMs' },
  { value: 'ai_agents', label: 'AI agents' },
  { value: 'defi_protocols', label: 'DeFi protocols' },
  { value: 'other', label: 'Other' },
] as const

const Q6_OPTIONS = [
  { value: 'trade_defi', label: 'Trade / DeFi' },
  { value: 'new_build', label: 'New build' },
  { value: 'job_outreach', label: 'Job / outreach' },
  { value: 'deploy_code', label: 'Deploy code' },
  { value: 'testnet_gov_airdrop', label: 'Testnet / gov / airdrop' },
  { value: 'public_write', label: 'Public write' },
] as const

function toggle(set: Set<string>, v: string) {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

function mapApiError(data: { error?: string; detail?: string }): string {
  switch (data.error) {
    case 'verify_email_first':
      return 'Please verify your email first'
    case 'add_key_first':
      return 'Add your Anthropic API key in Settings'
    case 'synthesis_failed':
      return 'Profile generation failed — please try again'
    case 'synthesis_request_failed':
      return 'Could not reach Claude. Please try again in a moment.'
    case 'missing_profile_model':
      return 'Profile synthesis is temporarily unavailable.'
    case 'invalid_answers':
      return typeof data.detail === 'string' ? data.detail : 'Some answers were invalid — check the form and try again.'
    case 'Unauthorized':
      return 'You need to sign in again.'
    default:
      return typeof data.error === 'string' ? data.error : 'Could not build profile'
  }
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [primaryFocus, setPrimaryFocus] = useState<Set<string>>(new Set())
  const [cryptoExperience, setCryptoExperience] = useState('')
  const [aiExperience, setAiExperience] = useState('')
  const [currentProject, setCurrentProject] = useState('')
  const [ecosystemFocus, setEcosystemFocus] = useState<Set<string>>(new Set())
  const [ecosystemOther, setEcosystemOther] = useState('')
  const [canActOn, setCanActOn] = useState<Set<string>>(new Set())
  const [riskAppetite, setRiskAppetite] = useState('')
  const [mustScoreHigh, setMustScoreHigh] = useState('')
  const [mustScoreLow, setMustScoreLow] = useState('')
  const [knowledgeBaseline, setKnowledgeBaseline] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewMd, setPreviewMd] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(true)

  function buildBody(): QuestionnaireAnswers {
    const eco: string[] = []
    for (const v of ecosystemFocus) {
      if (v === 'other') continue
      eco.push(v)
    }
    if (ecosystemFocus.has('other')) {
      eco.push('other')
      const note = ecosystemOther.trim()
      if (note) eco.push(`other_detail:${note.slice(0, 100)}`)
    }
    return {
      primaryFocus: [...primaryFocus],
      cryptoExperience,
      aiExperience,
      currentProject: currentProject.trim(),
      ecosystemFocus: eco,
      canActOn: [...canActOn],
      riskAppetite,
      mustScoreHigh: mustScoreHigh.trim(),
      mustScoreLow: mustScoreLow.trim(),
      knowledgeBaseline: knowledgeBaseline.trim(),
    }
  }

  async function submitSynthesis() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/synthesize-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      })
      const data = (await res.json().catch(() => ({}))) as {
        scoring_markdown?: string
        error?: string
        detail?: string
      }
      if (!res.ok) {
        setError(mapApiError(data))
        return
      }
      if (typeof data.scoring_markdown === 'string') {
        setPreviewMd(data.scoring_markdown)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canNext0 = primaryFocus.size > 0 && cryptoExperience && aiExperience
  const canNext1 =
    currentProject.trim().length > 0 &&
    currentProject.trim().length <= MAX_FREE &&
    ecosystemFocus.size > 0
  const freeOk =
    mustScoreHigh.trim().length > 0 &&
    mustScoreHigh.trim().length <= MAX_FREE &&
    mustScoreLow.trim().length > 0 &&
    mustScoreLow.trim().length <= MAX_FREE &&
    knowledgeBaseline.trim().length > 0 &&
    knowledgeBaseline.trim().length <= MAX_FREE
  const canSubmit = canActOn.size > 0 && Boolean(riskAppetite) && freeOk

  return (
    <main className="signal-wrdlss-shell signal-hero-bg px-5 py-12 md:py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-black/70 p-8 text-zinc-100 shadow-xl backdrop-blur-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Onboarding</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-zinc-50">Your signal profile</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Step {step + 1} of 3 — answers are sent once to Claude to build the markdown Haiku uses to score your feed.
        </p>

        {previewMd === null ? (
          <>
            {step === 0 ? (
              <div className="mt-8 space-y-6">
                <fieldset>
                  <legend className="font-mono text-xs text-zinc-400">Who you are — primary focus (pick all)</legend>
                  <div className="mt-2 space-y-2">
                    {Q1_OPTIONS.map((o) => (
                      <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={primaryFocus.has(o.value)}
                          onChange={() => setPrimaryFocus((s) => toggle(s, o.value))}
                          className="rounded border-white/20"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="q2" className="font-mono text-xs text-zinc-400">
                    Crypto experience
                  </label>
                  <select
                    id="q2"
                    value={cryptoExperience}
                    onChange={(e) => setCryptoExperience(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                  >
                    <option value="">Select…</option>
                    {Q2_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="q3" className="font-mono text-xs text-zinc-400">
                    AI / ML experience
                  </label>
                  <select
                    id="q3"
                    value={aiExperience}
                    onChange={(e) => setAiExperience(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                  >
                    <option value="">Select…</option>
                    {Q3_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!canNext0}
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl border border-white/20 bg-white py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mt-8 space-y-6">
                <div>
                  <label htmlFor="q4" className="font-mono text-xs text-zinc-400">
                    What you&apos;re building or working on
                  </label>
                  <textarea
                    id="q4"
                    required
                    rows={4}
                    maxLength={MAX_FREE}
                    value={currentProject}
                    onChange={(e) => setCurrentProject(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                    placeholder="e.g. Building an AI agent that monitors DeFi liquidations…"
                  />
                  <p className="mt-1 text-right text-xs text-zinc-500">
                    {currentProject.length} / {MAX_FREE}
                  </p>
                </div>
                <fieldset>
                  <legend className="font-mono text-xs text-zinc-400">Ecosystems & tech (pick all)</legend>
                  <div className="mt-2 space-y-2">
                    {Q5_OPTIONS.map((o) => (
                      <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={ecosystemFocus.has(o.value)}
                          onChange={() => setEcosystemFocus((s) => toggle(s, o.value))}
                          className="rounded border-white/20"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {ecosystemFocus.has('other') ? (
                  <div>
                    <label htmlFor="q5other" className="font-mono text-xs text-zinc-400">
                      Other (optional detail)
                    </label>
                    <input
                      id="q5other"
                      value={ecosystemOther}
                      onChange={(e) => setEcosystemOther(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                      placeholder="e.g. Cosmos, Move chains…"
                    />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 rounded-xl border border-white/15 py-2 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canNext1}
                    onClick={() => setStep(2)}
                    className="flex-1 rounded-xl border border-white/20 bg-white py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-8 space-y-6">
                <fieldset>
                  <legend className="font-mono text-xs text-zinc-400">
                    What you can act on within a week (pick all)
                  </legend>
                  <div className="mt-2 space-y-2">
                    {Q6_OPTIONS.map((o) => (
                      <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={canActOn.has(o.value)}
                          onChange={() => setCanActOn((s) => toggle(s, o.value))}
                          className="rounded border-white/20"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <p className="font-mono text-xs text-zinc-400">Risk appetite</p>
                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="q7"
                        value="bleeding_edge"
                        checked={riskAppetite === 'bleeding_edge'}
                        onChange={() => setRiskAppetite('bleeding_edge')}
                        className="border-white/20"
                      />
                      Bleeding edge
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="q7"
                        value="early_adopter"
                        checked={riskAppetite === 'early_adopter'}
                        onChange={() => setRiskAppetite('early_adopter')}
                        className="border-white/20"
                      />
                      Early adopter
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="q7"
                        value="validated"
                        checked={riskAppetite === 'validated'}
                        onChange={() => setRiskAppetite('validated')}
                        className="border-white/20"
                      />
                      Validated
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="q8" className="font-mono text-xs text-zinc-400">
                    Topics that should always score high
                  </label>
                  <textarea
                    id="q8"
                    rows={3}
                    maxLength={MAX_FREE}
                    value={mustScoreHigh}
                    onChange={(e) => setMustScoreHigh(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                  />
                  <p className="mt-1 text-right text-xs text-zinc-500">
                    {mustScoreHigh.length} / {MAX_FREE}
                  </p>
                </div>
                <div>
                  <label htmlFor="q9" className="font-mono text-xs text-zinc-400">
                    Topics to always filter out
                  </label>
                  <textarea
                    id="q9"
                    rows={3}
                    maxLength={MAX_FREE}
                    value={mustScoreLow}
                    onChange={(e) => setMustScoreLow(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                  />
                  <p className="mt-1 text-right text-xs text-zinc-500">
                    {mustScoreLow.length} / {MAX_FREE}
                  </p>
                </div>
                <div>
                  <label htmlFor="q10" className="font-mono text-xs text-zinc-400">
                    What can we assume you already know?
                  </label>
                  <textarea
                    id="q10"
                    rows={3}
                    maxLength={MAX_FREE}
                    value={knowledgeBaseline}
                    onChange={(e) => setKnowledgeBaseline(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/35"
                  />
                  <p className="mt-1 text-right text-xs text-zinc-500">
                    {knowledgeBaseline.length} / {MAX_FREE}
                  </p>
                </div>
                {submitting ? (
                  <p className="text-sm text-zinc-200">Building your scoring profile with Claude…</p>
                ) : null}
                {error ? <p className="text-sm text-amber-200">{error}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 rounded-xl border border-white/15 py-2 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={() => void submitSynthesis()}
                    className="flex-1 rounded-xl border border-white/20 bg-white py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {submitting ? 'Building profile…' : 'Build scoring profile'}
                  </button>
                </div>
                <p className="text-center text-xs text-zinc-500">
                  Uses your Anthropic key (BYOK) with Sonnet once. Haiku still scores batches.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-emerald-200">Profile generated. This is what Haiku will use to score your feed.</p>
            <button
              type="button"
              onClick={() => setPreviewOpen((o) => !o)}
              className="text-sm font-medium text-white underline"
            >
              {previewOpen ? 'Hide' : 'Show'} markdown preview
            </button>
            {previewOpen ? (
              <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/80 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                {previewMd}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={() => window.location.assign('/feed')}
              className="w-full rounded-xl border border-white/20 bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200"
            >
              Looks good → go to feed
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-zinc-500">
          <Link href="/settings" className="underline hover:text-zinc-200">
            Back to Settings
          </Link>
        </p>
      </div>
    </main>
  )
}
