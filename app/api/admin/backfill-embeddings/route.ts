import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { embedTexts } from '@/lib/embeddings'

export const maxDuration = 300

const BATCH_SIZE = 500

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  let totalProcessed = 0
  let totalFailed = 0
  let cursor: string | null = null
  let hasMore = true
  const startTime = Date.now()

  while (hasMore) {
    let query = db
      .from('raw_stories')
      .select('id, title, summary, raw_text')
      .is('embedding', null)

    if (cursor) {
      query = query.gt('id', cursor)
    }

    query = query.order('id', { ascending: true }).limit(BATCH_SIZE)

    const { data: rows, error: fetchErr } = await query

    if (fetchErr) {
      console.error('[Backfill] Fetch error:', fetchErr.message)
      return NextResponse.json(
        { success: false, error: fetchErr.message, processed: totalProcessed },
        { status: 500 }
      )
    }

    if (!rows || rows.length === 0) {
      hasMore = false
      break
    }

    const texts = rows.map((r) =>
      [r.title, r.summary, r.raw_text].filter(Boolean).join(' ').slice(0, 2000)
    )

    let vectors: number[][]
    try {
      vectors = await embedTexts(texts)
    } catch (embErr) {
      console.error('[Backfill] OpenAI batch failed:', embErr)
      totalFailed += rows.length
      cursor = rows[rows.length - 1].id as string
      continue
    }

    await Promise.all(
      rows.map((r, i) =>
        vectors[i]
          ? db.from('raw_stories').update({ embedding: vectors[i] }).eq('id', r.id)
          : Promise.resolve()
      )
    )

    totalProcessed += rows.length
    cursor = rows[rows.length - 1].id as string

    console.log(`[Backfill] Processed ${totalProcessed} rows so far (last id: ${cursor})`)

    if (Date.now() - startTime > 200_000) {
      console.warn('[Backfill] Approaching timeout — stopping early. Re-invoke to continue.')
      hasMore = false
    }
  }

  return NextResponse.json({
    success: true,
    processed: totalProcessed,
    failed: totalFailed,
  })
}
