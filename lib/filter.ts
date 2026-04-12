import Anthropic from '@anthropic-ai/sdk'
import {
  buildPreferenceOverlay,
  DEFAULT_PIPELINE_PREFS,
  FILTER_RUN_BATCH_ABS_MAX,
  FILTER_RUN_BATCH_MIN,
  FILTER_RUN_MAX_CANDIDATES_MIN,
  minScoreToStoreForScope,
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

const RAW_FETCH_LIMIT = intEnv('FILTER_RAW_FETCH_LIMIT', 400, 800)
const MAX_CANDIDATES = intEnv('FILTER_MAX_CANDIDATES', 80, 200)
/** Avoid hanging forever if Anthropic is slow or unreachable. */
const BATCH_TIMEOUT_MS = 120_000
const BATCH_CONCURRENCY = 2

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

/** Strip byte-order mark if present. */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

/**
 * If `parsed` is a plain object (not array), check common wrapper keys
 * ("stories", "results", "items", "scores") and return the first array value found.
 * Returns null if none found.
 */
function tryUnwrapArrayFromObject(parsed: unknown): unknown[] | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>
  for (const key of ['stories', 'results', 'items', 'scores']) {
    if (Array.isArray(o[key])) return o[key] as unknown[]
  }
  return null
}

/**
 * Walk `text` character by character tracking JSON string boundaries so brackets
 * inside string values ("see [link]") are not counted as structural.
 * Returns the substring of the first complete top-level [...] array, or null.
 */
function extractJsonArrayStringAware(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '[') {
      if (depth === 0) start = i
      depth++
    } else if (ch === ']') {
      depth--
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1)
      }
    }
  }
  return null
}

type ParsePath = 'direct' | 'unwrap_object' | 'extracted_array' | 'failed'

/**
 * Try every recovery path in order. Returns the parsed array and which path succeeded,
 * or ok:false with the path "failed" and a short snippet for logging.
 */
function tryParseScoredArray(
  text: string
): { ok: true; results: unknown[]; path: ParsePath } | { ok: false; path: 'failed'; snippet: string } {
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) return { ok: true, results: parsed, path: 'direct' }
    const unwrapped = tryUnwrapArrayFromObject(parsed)
    if (unwrapped) return { ok: true, results: unwrapped, path: 'unwrap_object' }
  } catch {
    // fall through to extraction
  }

  const extracted = extractJsonArrayStringAware(text)
  if (extracted) {
    try {
      const parsed2: unknown = JSON.parse(extracted)
      if (Array.isArray(parsed2)) return { ok: true, results: parsed2, path: 'extracted_array' }
      const unwrapped2 = tryUnwrapArrayFromObject(parsed2)
      if (unwrapped2) return { ok: true, results: unwrapped2, path: 'unwrap_object' }
    } catch {
      // fall through
    }
  }

  return { ok: false, path: 'failed', snippet: text.slice(0, 500) }
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
  /** Per-run cap (clamped to env `FILTER_MAX_CANDIDATES` and min 40). Omit = use env default. */
  maxCandidates?: number
  /** Haiku batch size (clamped 10–40 and ≤ max for run). Omit = use env default. */
  batchSize?: number
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
    // 30 stories × ~600 chars of JSON output each ≈ 5–7k tokens; 4096 was truncating large batches.
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const stopReason = response.stop_reason ?? 'unknown'

  const normalized = stripBom(rawText)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  const parseResult = tryParseScoredArray(normalized)

  let results: ScoredResult[]
  let parseFailed = false

  if (parseResult.ok) {
    results = parseResult.results as ScoredResult[]
    if (parseResult.path !== 'direct') {
      console.warn(`[Filter] parse_path=${parseResult.path} — recovered from non-standard response`)
    }
  } else {
    parseFailed = true
    results = []
    const outTok =
      typeof response.usage?.output_tokens === 'number' ? response.usage.output_tokens : 'n/a'
    console.error(
      `[Filter] parse_path=failed stop_reason=${stopReason} output_tokens=${outTok} snippet=${parseResult.snippet}`
    )
  }

  const usage = response.usage
  return {
    results,
    inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : 0,
    outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0,
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
  totalBatches: number
  parseFailureBatchIndices: number[]
}> {
  const prefs = ctx.prefs ?? DEFAULT_PIPELINE_PREFS
  const minStoreScore = minScoreToStoreForScope(prefs.scope)
  const client = new Anthropic({ apiKey: ctx.anthropicApiKey })
  const db = getSupabaseAdmin()

  const maxCandidatesCap = MAX_CANDIDATES
  const maxForRun =
    ctx.maxCandidates != null
      ? Math.min(
          Math.max(FILTER_RUN_MAX_CANDIDATES_MIN, Math.round(ctx.maxCandidates)),
          maxCandidatesCap
        )
      : maxCandidatesCap

  const envBatchDefault = Math.min(intEnv('FILTER_BATCH_SIZE', 24, 40), maxForRun)
  const batchForRun =
    ctx.batchSize != null
      ? Math.max(
          FILTER_RUN_BATCH_MIN,
          Math.min(Math.round(ctx.batchSize), FILTER_RUN_BATCH_ABS_MAX, maxForRun)
        )
      : envBatchDefault

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
      totalBatches: 0,
      parseFailureBatchIndices: [],
    }
  }

  const ids = raws.map((r) => r.id)
  const { data: doneRows } = await db
    .from('user_raw_scored')
    .select('raw_story_id')
    .eq('user_id', ctx.userId)
    .in('raw_story_id', ids)

  const done = new Set((doneRows ?? []).map((d) => d.raw_story_id as string))
  const candidates = raws.filter((r) => !done.has(r.id)).slice(0, maxForRun)

  if (candidates.length === 0) {
    return {
      processed: 0,
      stored: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0,
      claudeParseFailures: 0,
      totalBatches: 0,
      parseFailureBatchIndices: [],
    }
  }

  console.log(
    `[Filter] User ${ctx.userId.slice(0, 8)}… — ${candidates.length} candidates (cap ${maxForRun}), batches of ${batchForRun}, minStoreScore=${minStoreScore}`
  )

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalStored = 0
  let totalMarked = 0
  let claudeParseFailures = 0
  const parseFailureBatchIndices: number[] = []

  const batches: RawStory[][] = []
  for (let i = 0; i < candidates.length; i += batchForRun) {
    batches.push(candidates.slice(i, i + batchForRun))
  }
  const totalBatches = batches.length

  for (let g = 0; g < batches.length; g += BATCH_CONCURRENCY) {
    const group = batches.slice(g, g + BATCH_CONCURRENCY)
    const settled = await Promise.all(
      group.map(async (batch, localIdx) => {
        const batchIdx = g + localIdx
        const batchLabel = `Haiku batch ${batchIdx + 1} of ${totalBatches}`
        try {
          const res = await withTimeout(
            scoreBatch(client, batch, ctx.userPrompt, prefs),
            BATCH_TIMEOUT_MS,
            batchLabel
          )
          return { batchIdx, batch, res }
        } catch (err) {
          console.error(`[Filter] ${batchLabel} failed:`, err)
          return null
        }
      })
    )

    for (const item of settled) {
      if (!item) continue
      const { batch, res } = item
      const { results, inputTokens, outputTokens, parseFailed } = res
      if (parseFailed) {
        claudeParseFailures += 1
        parseFailureBatchIndices.push(item.batchIdx + 1)
      }
      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      const resultById = new Map(results.map((r) => [r.id, r]))
      const markRows: { user_id: string; raw_story_id: string }[] = []
      const toInsert: Record<string, unknown>[] = []

      for (const story of batch) {
        const r = resultById.get(story.id)
        if (!r) continue

        markRows.push({ user_id: ctx.userId, raw_story_id: story.id })

        if (r.score >= minStoreScore && r.category !== 'noise') {
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
        `[Filter] Batch ${item.batchIdx + 1}: parsed ${results.length}, marked ${markRows.length}, stored ${toInsert.length}`
      )
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
    totalBatches,
    parseFailureBatchIndices,
  }
}
