import Anthropic from '@anthropic-ai/sdk'
import {
  buildPreferenceOverlay,
  DEFAULT_PIPELINE_PREFS,
  type PipelinePreferences,
} from './pipeline-preferences'
import { getSupabaseAdmin } from './supabase-server'

const MODEL = 'claude-haiku-4-5-20251001'

function intEnv(name: string, fallback: number, cap: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, cap)
}

/** Fewer stories per run keeps the pipeline responsive (each batch is one Haiku call). */
const MIN_SCORE_TO_STORE = 5
const RAW_FETCH_LIMIT = intEnv('FILTER_RAW_FETCH_LIMIT', 400, 800)
const MAX_CANDIDATES = intEnv('FILTER_MAX_CANDIDATES', 36, 200)
const BATCH_SIZE = Math.min(intEnv('FILTER_BATCH_SIZE', 18, 40), MAX_CANDIDATES)
/** Avoid hanging forever if Anthropic is slow or unreachable. */
const BATCH_TIMEOUT_MS = 120_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

interface RawStory {
  id: string
  title: string
  url: string
  source: string
  raw_text: string
  published_at: string | null
}

interface ScoredResult {
  id: string
  score: number
  category: 'opportunity' | 'idea' | 'intel' | 'noise'
  why: string
  summary: string
}

export interface RunFilterContext {
  userId: string
  anthropicApiKey: string
  /** Full profile block (defaults + onboarding) */
  userPrompt: string
  prefs?: PipelinePreferences
}

async function scoreBatch(
  client: Anthropic,
  stories: RawStory[],
  userPrompt: string,
  prefs: PipelinePreferences
): Promise<{
  results: ScoredResult[]
  inputTokens: number
  outputTokens: number
  parseFailed: boolean
}> {
  const storiesPayload = stories.map((s) => ({
    id: s.id,
    title: s.title,
    text: s.raw_text?.slice(0, 500) ?? '',
  }))

  const overlay = buildPreferenceOverlay(prefs)

  const prompt = `${overlay}

---
BASE USER PROFILE (categories, voice, and user goals — topical relevance for this batch is governed by the run-specific block above; do not use this section to justify high scores for stories that miss <user_focus>):
${userPrompt}

Score each of the following stories. Return ONLY a valid JSON array — no markdown, no explanation, just the array.

Each object must have:
- "id": the story id (string, unchanged)
- "score": integer 1-10
- "category": one of "opportunity", "idea", "intel", "noise"
- "why": one sentence explaining the score relative to the user's goals and the run focus
- "summary": two sentences plain-English summary of what the story is about

Stories to score:
${JSON.stringify(storiesPayload, null, 2)}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let results: ScoredResult[]
  let parseFailed = false
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) {
      parseFailed = true
      results = []
      console.error('[Filter] Claude returned non-array JSON:', cleaned.slice(0, 500))
    } else {
      results = parsed as ScoredResult[]
    }
  } catch {
    parseFailed = true
    console.error('[Filter] Failed to parse Claude response (first 2000 chars):', cleaned.slice(0, 2000))
    results = []
  }

  return {
    results,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    parseFailed,
  }
}

/**
 * Per-user filter: scores raw_stories not yet in user_raw_scored for this user.
 * Newest raw rows first so fresh scrapes stay in the candidate window when the pool is large.
 */
export async function runFilterPipeline(ctx: RunFilterContext): Promise<{
  processed: number
  stored: number
  totalInputTokens: number
  totalOutputTokens: number
  estimatedCost: number
  claudeParseFailures: number
}> {
  const prefs = ctx.prefs ?? DEFAULT_PIPELINE_PREFS
  const client = new Anthropic({ apiKey: ctx.anthropicApiKey })
  const db = getSupabaseAdmin()

  const { data: raws, error: fetchError } = await db
    .from('raw_stories')
    .select('id, title, url, source, raw_text, published_at')
    .order('scraped_at', { ascending: false })
    .limit(RAW_FETCH_LIMIT)

  if (fetchError) throw new Error(`Failed to fetch raw stories: ${fetchError.message}`)
  if (!raws?.length) {
    return {
      processed: 0,
      stored: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0,
      claudeParseFailures: 0,
    }
  }

  const ids = raws.map((r) => r.id)
  const { data: doneRows } = await db
    .from('user_raw_scored')
    .select('raw_story_id')
    .eq('user_id', ctx.userId)
    .in('raw_story_id', ids)

  const done = new Set((doneRows ?? []).map((d) => d.raw_story_id as string))
  const candidates = raws.filter((r) => !done.has(r.id)).slice(0, MAX_CANDIDATES)

  if (candidates.length === 0) {
    return {
      processed: 0,
      stored: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0,
      claudeParseFailures: 0,
    }
  }

  console.log(
    `[Filter] User ${ctx.userId.slice(0, 8)}… — ${candidates.length} candidates, batches of ${BATCH_SIZE}`
  )

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalStored = 0
  let totalMarked = 0
  let claudeParseFailures = 0

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)

    try {
      const batchLabel = `Haiku batch ${Math.floor(i / BATCH_SIZE) + 1}`
      const { results, inputTokens, outputTokens, parseFailed } = await withTimeout(
        scoreBatch(client, batch, ctx.userPrompt, prefs),
        BATCH_TIMEOUT_MS,
        batchLabel
      )
      if (parseFailed) claudeParseFailures += 1
      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      const resultById = new Map(results.map((r) => [r.id, r]))
      const markRows: { user_id: string; raw_story_id: string }[] = []
      const toInsert: Record<string, unknown>[] = []

      for (const story of batch) {
        const r = resultById.get(story.id)
        if (!r) continue

        markRows.push({ user_id: ctx.userId, raw_story_id: story.id })

        if (r.score >= MIN_SCORE_TO_STORE && r.category !== 'noise') {
          toInsert.push({
            user_id: ctx.userId,
            raw_story_id: story.id,
            title: story.title,
            url: story.url,
            source: story.source,
            published_at: story.published_at,
            score: r.score,
            category: r.category,
            summary: r.summary,
            why: r.why,
          })
        }
      }

      if (markRows.length > 0) {
        const { error: markErr } = await db.from('user_raw_scored').upsert(markRows, {
          onConflict: 'user_id,raw_story_id',
        })
        if (markErr) {
          console.error('[Filter] user_raw_scored upsert error:', markErr.message)
        } else {
          totalMarked += markRows.length
        }
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await db.from('scored_stories').insert(toInsert)
        if (insertError) {
          console.error('[Filter] Insert error:', insertError.message)
        } else {
          totalStored += toInsert.length
        }
      }

      console.log(
        `[Filter] Batch ${Math.floor(i / BATCH_SIZE) + 1}: parsed ${results.length}, marked ${markRows.length}, stored ${toInsert.length}`
      )
    } catch (err) {
      console.error(`[Filter] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err)
    }
  }

  const estimatedCost =
    (totalInputTokens / 1_000_000) * 0.8 + (totalOutputTokens / 1_000_000) * 4.0

  await db.from('api_usage').insert({
    user_id: ctx.userId,
    stories_scored: totalMarked,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    estimated_cost: estimatedCost,
  })

  console.log(
    `[Filter] Done. Marked: ${totalMarked}, Stored: ${totalStored}, Tokens: ${totalInputTokens}in/${totalOutputTokens}out, parseFailures: ${claudeParseFailures}`
  )

  return {
    processed: totalMarked,
    stored: totalStored,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost,
    claudeParseFailures,
  }
}
