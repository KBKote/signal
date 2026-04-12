import { NextResponse } from 'next/server'
import type { PostgrestError } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth/session'
import { assertUserReadyForPipeline } from '@/lib/auth/user-setup-gates'
import { getSupabaseAdmin } from '@/lib/supabase-server'

const ARCHIVE_HOURS = 48
const FEED_MAX_AGE_DAYS = parseInt(process.env.FEED_MAX_AGE_DAYS ?? '7', 10) || 7
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 80
/** Lowest score returned in the feed — must be <= expansive pipeline store floor (4). */
const MIN_FEED_SCORE = 4

const STORY_COLUMNS =
  'id,raw_story_id,title,url,source,summary,category,score,why,published_at,scored_at,seen,notified'

type StoryCursor = { score: number; scored_at: string; id: string }

/** Shape returned by RPC and REST select (used for cursor + JSON response). */
type ScoredStoryRow = {
  id: string
  raw_story_id: string | null
  title: string
  url: string
  source: string | null
  summary: string | null
  category: string
  score: number
  why: string | null
  published_at: string | null
  scored_at: string
  seen: boolean
  notified: boolean
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

function encodeStoryCursor(row: { score: number; scored_at: string; id: string }): string {
  const payload: StoryCursor = {
    score: row.score,
    scored_at: row.scored_at,
    id: row.id,
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeStoryCursor(raw: string): StoryCursor | null {
  try {
    const j = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (typeof o.score !== 'number' || typeof o.scored_at !== 'string' || typeof o.id !== 'string') {
      return null
    }
    return { score: o.score, scored_at: o.scored_at, id: o.id }
  } catch {
    return null
  }
}

/** PostgREST keyset filter: rows strictly after `c` in (score desc, scored_at desc, id desc). */
function keysetOrFilter(c: StoryCursor): string {
  const ts = c.scored_at.replace(/"/g, '')
  const id = c.id.replace(/"/g, '')
  return `score.lt.${c.score},and(score.eq.${c.score},scored_at.lt."${ts}"),and(score.eq.${c.score},scored_at.eq."${ts}",id.lt.${id})`
}

function isMissingStoriesRpc(err: PostgrestError): boolean {
  const m = (err.message ?? '').toLowerCase()
  return m.includes('api_scored_stories_page') || m.includes('does not exist')
}

async function fetchStoriesViaRest(
  userId: string,
  cutoff: string,
  fetchLimit: number,
  cursor: StoryCursor | null
): Promise<{ data: ScoredStoryRow[] | null; error: PostgrestError | null }> {
  const db = getSupabaseAdmin()
  const publishedCutoff = new Date(Date.now() - FEED_MAX_AGE_DAYS * 24 * 3_600_000).toISOString()
  let q = db
    .from('scored_stories')
    .select(STORY_COLUMNS)
    .eq('user_id', userId)
    .gte('scored_at', cutoff)
    .gte('score', MIN_FEED_SCORE)
    .or(`published_at.is.null,published_at.gte."${publishedCutoff}"`)

  if (cursor) {
    q = q.or(keysetOrFilter(cursor))
  }

  const { data, error } = await q
    .order('score', { ascending: false })
    .order('scored_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  return { data: data as ScoredStoryRow[] | null, error }
}

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ready = await assertUserReadyForPipeline(user)
  if (!ready.ok) return ready.response

  const { searchParams } = new URL(request.url)
  const limit = clamp(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1, MAX_LIMIT)
  const cursorRaw = searchParams.get('cursor')
  const cursor = cursorRaw ? decodeStoryCursor(cursorRaw) : null
  if (cursorRaw && !cursor) {
    return NextResponse.json({ success: false, error: 'Invalid cursor' }, { status: 400 })
  }

  const cutoff = new Date(Date.now() - ARCHIVE_HOURS * 3_600_000).toISOString()
  const publishedCutoff = new Date(Date.now() - FEED_MAX_AGE_DAYS * 24 * 3_600_000).toISOString()

  const fetchLimit = limit + 1
  let rows: ScoredStoryRow[] = []
  console.log(
    `[/api/stories] published_at freshness cutoff=${publishedCutoff} (FEED_MAX_AGE_DAYS=${FEED_MAX_AGE_DAYS}); RPC api_scored_stories_page does not apply this filter yet`
  )
  const { data: rpcData, error: rpcError } = await getSupabaseAdmin().rpc('api_scored_stories_page', {
    p_user_id: user.id,
    p_limit: fetchLimit,
    p_cutoff: cutoff,
    p_min_score: MIN_FEED_SCORE,
    p_cursor_score: cursor?.score ?? null,
    p_cursor_scored_at: cursor?.scored_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })

  if (rpcError) {
    if (isMissingStoriesRpc(rpcError)) {
      console.warn(
        '[/api/stories] RPC api_scored_stories_page missing — using REST keyset fallback. Apply migration 20260411140000_api_scored_stories_page.sql for the indexed RPC path.'
      )
      const { data: restData, error: restError } = await fetchStoriesViaRest(
        user.id,
        cutoff,
        fetchLimit,
        cursor
      )
      if (restError) {
        console.error('[/api/stories] REST fallback failed:', restError)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch stories' },
          { status: 500 }
        )
      }
      rows = restData ?? []
    } else {
      console.error('[/api/stories] Failed to fetch stories:', rpcError)
      return NextResponse.json({ success: false, error: 'Failed to fetch stories' }, { status: 500 })
    }
  } else {
    rows = (rpcData ?? []) as ScoredStoryRow[]
  }
  const hasMore = rows.length > limit
  const pageRows: ScoredStoryRow[] = hasMore ? rows.slice(0, limit) : rows
  const last = pageRows.length > 0 ? pageRows[pageRows.length - 1]! : null
  const nextCursor = hasMore && last ? encodeStoryCursor(last) : null

  return NextResponse.json({
    success: true,
    stories: pageRows,
    limit,
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
  })
}
