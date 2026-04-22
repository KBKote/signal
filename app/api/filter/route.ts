import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { assertUserReadyForPipeline } from '@/lib/auth/user-setup-gates'
import { takeFilterRateSlotDb } from '@/lib/filter-rate-limit'
import { takeScrapeRateSlotDb } from '@/lib/scrape-rate-limit'
import { runFilterPipeline } from '@/lib/filter'
import { parseFilterRequestPayload, DEFAULT_PIPELINE_PREFS } from '@/lib/pipeline-preferences'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { buildScoringUserPrompt } from '@/lib/user-profile-prompt'
import { loadUserProfileRow } from '@/lib/user-profiles-db'
import { sendNotificationsForNewStories } from '@/lib/notifications'

/** Vercel: raise on paid plans if filter still hits limits; local dev is uncapped. */
/** Large maxCandidates + small batchSize can mean many sequential Haiku calls. */
export const maxDuration = 300

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ready = await assertUserReadyForPipeline(user)
  if (!ready.ok) return ready.response
  const apiKey = ready.anthropicApiKey

  const rateMsg = await takeFilterRateSlotDb(user.id)
  if (rateMsg) {
    return NextResponse.json({ error: rateMsg }, { status: 429 })
  }

  // Auto-trigger scrape if user hasn't scraped in 24h — ensures fresh pool before scoring
  // Awaited with a 4s timeout so the scrape endpoint starts its own Vercel invocation.
  // Filter proceeds regardless of whether the scrape fires or completes.
  const scrapeRateMsg = await takeScrapeRateSlotDb(user.id)
  if (!scrapeRateMsg) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4_000)
        await fetch(`${siteUrl}/api/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ topicMode: 'intersection' }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId))
      } catch {
        // AbortError (timeout) or network error — expected; scrape may still be running
      }
    }
  }

  let prefs = DEFAULT_PIPELINE_PREFS
  let maxCandidates: number | undefined
  let batchSize: number | undefined
  try {
    const ct = request.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const raw: unknown = await request.json()
      const parsed = parseFilterRequestPayload(raw)
      prefs = parsed.prefs
      maxCandidates = parsed.maxCandidates
      batchSize = parsed.batchSize
    }
  } catch {
    prefs = DEFAULT_PIPELINE_PREFS
  }

  console.log(
    `[/api/filter] prefs topicMode=${prefs.topicMode} scope=${prefs.scope} customLen=${prefs.topicCustom.length}` +
      (maxCandidates != null || batchSize != null
        ? ` runTuning maxCandidates=${maxCandidates ?? 'default'} batchSize=${batchSize ?? 'default'}`
        : '')
  )

  const profileRow = await loadUserProfileRow(user.id)
  const userPrompt = buildScoringUserPrompt(
    profileRow?.profile ?? {},
    profileRow?.scoring_markdown ?? null
  )

  try {
    const result = await runFilterPipeline({
      userId: user.id,
      anthropicApiKey: apiKey,
      userPrompt,
      prefs,
      maxCandidates,
      batchSize,
    })

    const notified = await sendNotificationsForNewStories(user.id)
    if (notified > 0) console.log(`[/api/filter] Sent ${notified} push notifications`)

    const baseline = profileRow ?? { profile: {}, onboarding_completed: false }
    const prev =
      baseline.profile && typeof baseline.profile === 'object'
        ? { ...(baseline.profile as Record<string, unknown>) }
        : {}
    const nextProfile = {
      ...prev,
      last_pipeline_prefs: {
        topicMode: prefs.topicMode,
        topicCustom: prefs.topicMode === 'other' ? prefs.topicCustom : '',
        scope: prefs.scope,
      },
    }
    const { error: prefsPersistErr } = await getSupabaseAdmin().from('user_profiles').upsert(
      {
        user_id: user.id,
        profile: nextProfile,
        onboarding_completed: baseline.onboarding_completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (prefsPersistErr) {
      console.warn('[/api/filter] Could not persist last_pipeline_prefs:', prefsPersistErr.message)
    }

    return NextResponse.json({
      ok: true,
      success: true,
      processed: result.processed,
      stored: result.stored,
      totalInputTokens: result.totalInputTokens,
      totalOutputTokens: result.totalOutputTokens,
      estimatedCost: result.estimatedCost,
      totalBatches: result.totalBatches,
      notified,
      candidateSource: result.candidateSource,
      candidateCap: result.candidateCap,
      candidatePoolSize: result.candidatePoolSize,
      batchSizeUsed: result.batchSizeUsed,
      serverEnvMaxCandidates: result.serverEnvMaxCandidates,
      ...(result.vectorFallbackReason
        ? { vectorFallbackReason: result.vectorFallbackReason }
        : {}),
      ...(result.claudeParseFailures > 0
        ? {
            parseWarning: `Claude returned ${result.claudeParseFailures} of ${result.totalBatches} batch(es) that could not be parsed as JSON (batch${result.parseFailureBatchIndices.length === 1 ? '' : 'es'} ${result.parseFailureBatchIndices.join(', ')}); check server logs.`,
          }
        : {}),
    })
  } catch (err) {
    console.error('[/api/filter] Error:', err)
    const message = err instanceof Error ? err.message : 'Filter pipeline failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * Cron filter removed for multi-tenant BYOK. Use per-user POST from the app.
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Use authenticated POST /api/filter from the app' },
    { status: 405 }
  )
}
