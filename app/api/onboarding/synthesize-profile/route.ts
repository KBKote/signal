import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isEmailVerified } from '@/lib/auth/user-setup-gates'
import { parseQuestionnaireAnswers } from '@/lib/questionnaire'
import {
  buildSynthesisPrompt,
  synthesisOutputHasRequiredHeadings,
} from '@/lib/profile-synthesis-prompt'
import { validateCsrfOrigin } from '@/lib/csrf'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getDecryptedAnthropicKey } from '@/lib/user-credentials'
import { loadUserProfileRow } from '@/lib/user-profiles-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function extractAssistantText(msg: Anthropic.Messages.Message): string {
  const parts: string[] = []
  for (const block of msg.content) {
    if (block.type === 'text') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

async function runSynthesis(
  apiKey: string,
  model: string,
  userPrompt: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = extractAssistantText(msg)
  const inputTokens =
    typeof msg.usage?.input_tokens === 'number' ? msg.usage.input_tokens : 0
  const outputTokens =
    typeof msg.usage?.output_tokens === 'number' ? msg.usage.output_tokens : 0
  return { text, inputTokens, outputTokens }
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  const apiKey = await getDecryptedAnthropicKey(user.id)
  if (!apiKey) {
    return NextResponse.json({ error: 'add_key_first' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!validateCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let answers
  try {
    answers = parseQuestionnaireAnswers(body)
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Invalid questionnaire payload'
    return NextResponse.json({ error: 'invalid_answers', detail }, { status: 400 })
  }

  const model = process.env.ANTHROPIC_PROFILE_MODEL?.trim()
  if (!model) {
    return NextResponse.json({ error: 'missing_profile_model' }, { status: 503 })
  }

  const userPrompt = buildSynthesisPrompt(answers)
  const db = getSupabaseAdmin()

  let text = ''
  let inputTokens = 0
  let outputTokens = 0

  try {
    const first = await runSynthesis(apiKey, model, userPrompt)
    text = first.text
    inputTokens += first.inputTokens
    outputTokens += first.outputTokens

    if (!synthesisOutputHasRequiredHeadings(text)) {
      const second = await runSynthesis(apiKey, model, userPrompt)
      text = second.text
      inputTokens += second.inputTokens
      outputTokens += second.outputTokens
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Synthesis request failed'
    console.error('[synthesize-profile]', msg)
    return NextResponse.json({ error: 'synthesis_request_failed' }, { status: 502 })
  }

  if (!synthesisOutputHasRequiredHeadings(text)) {
    return NextResponse.json({ error: 'synthesis_failed' }, { status: 500 })
  }

  const existing = await loadUserProfileRow(user.id)
  const profile =
    existing?.profile && typeof existing.profile === 'object' ? existing.profile : {}
  const onboarding_completed = existing?.onboarding_completed ?? true
  const now = new Date().toISOString()

  const { error: upsertErr } = await db.from('user_profiles').upsert(
    {
      user_id: user.id,
      profile,
      onboarding_completed,
      scoring_markdown: text,
      questionnaire_answers: answers as unknown as Record<string, unknown>,
      synthesized_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  )

  if (upsertErr) {
    console.error('[synthesize-profile] upsert', upsertErr.message)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  const estimatedCost =
    (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0

  await db.from('api_usage').insert({
    user_id: user.id,
    stories_scored: 0,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost: estimatedCost,
  })

  return NextResponse.json({ scoring_markdown: text })
}
