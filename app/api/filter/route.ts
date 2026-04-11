import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { takeFilterRateSlotDb } from '@/lib/filter-rate-limit'
import { runFilterPipeline } from '@/lib/filter'
import {
  parsePipelinePreferencesBody,
  DEFAULT_PIPELINE_PREFS,
} from '@/lib/pipeline-preferences'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getDecryptedAnthropicKey } from '@/lib/user-credentials'
import { buildScoringUserPrompt } from '@/lib/user-profile-prompt'
import { loadUserProfileRow } from '@/lib/user-profiles-db'
import { sendNotificationsForNewStories } from '@/lib/notifications'

/** Vercel: raise on paid plans if filter still hits limits; local dev is uncapped. */
export const maxDuration = 120

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = await getDecryptedAnthropicKey(user.id)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Add your Anthropic API key in Settings' },
      { status: 400 }
    )
  }

  const rateMsg = await takeFilterRateSlotDb(user.id)
  if (rateMsg) {
    return NextResponse.json({ error: rateMsg }, { status: 429 })
  }

  let prefs = DEFAULT_PIPELINE_PREFS
  try {
    const ct = request.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const raw: unknown = await request.json()
      prefs = parsePipelinePreferencesBody(raw)
    }
  } catch {
    prefs = DEFAULT_PIPELINE_PREFS
  }

  console.log(
    `[/api/filter] prefs topicMode=${prefs.topicMode} scope=${prefs.scope} customLen=${prefs.topicCustom.length}`
  )

  const profileRow = await loadUserProfileRow(user.id)
  const userPrompt = buildScoringUserPrompt(profileRow?.profile ?? {})

  try {
    const result = await runFilterPipeline({
      userId: user.id,
      anthropicApiKey: apiKey,
      userPrompt,
      prefs,
    })

    const notified = await sendNotificationsForNewStories(user.id)
    if (notified > 0) console.log(`[/api/filter] Sent ${notified} push notifications`)

    const parseWarning =
      result.claudeParseFailures > 0
        ? `Claude returned ${result.claudeParseFailures} batch(es) that could not be parsed as JSON; check server logs.`
        : undefined

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
      success: true,
      ...result,
      notified,
      ...(parseWarning ? { parseWarning } : {}),
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
