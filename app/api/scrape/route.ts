import { NextResponse } from 'next/server'
import { scrapeAccessDeniedResponse } from '@/lib/scrape-auth'
import { runRetentionCleanup } from '@/lib/db-cleanup'
import { DEFAULT_PIPELINE_PREFS, parsePipelinePreferencesBody } from '@/lib/pipeline-preferences'
import { getScrapePack } from '@/lib/scrape-sources'
import { scrapeRssFeeds } from '@/lib/scraper/rss'
import { scrapeReddit } from '@/lib/scraper/reddit'
import { scrapeHackerNews } from '@/lib/scraper/hn'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { embedTexts } from '@/lib/embeddings'

export const maxDuration = 60 // Vercel function timeout (seconds)

export async function POST(request: Request) {
  const denied = await scrapeAccessDeniedResponse(request)
  if (denied) return denied

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

  const pack = getScrapePack(prefs)
  console.log(
    `[Scrape] topicMode=${prefs.topicMode} rss=${pack.rssFeeds.length} subs=${pack.subreddits.length}`
  )

  const startTime = Date.now()
  const db = getSupabaseAdmin()

  try {
    // 1. Collect from all sources in parallel (reach widens by topic)
    console.log('[Scrape] Starting data collection...')
    const [rssStories, redditStories, hnStories] = await Promise.all([
      scrapeRssFeeds(pack.rssFeeds),
      scrapeReddit(pack.subreddits),
      scrapeHackerNews(pack.hnQuery),
    ])

    const allStories = [...rssStories, ...redditStories, ...hnStories]
    console.log(`[Scrape] Collected ${allStories.length} stories total`)

    // Drop stories older than FEED_MAX_AGE_DAYS (default 7) at insert time so stale
    // content never enters raw_stories and pollutes the scoring pool.
    const maxAgeDays = Math.min(parseInt(process.env.FEED_MAX_AGE_DAYS ?? '7', 10) || 7, 30)
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
    const freshStories = allStories.filter((s) => {
      if (!s.published_at) return true
      return Date.now() - new Date(s.published_at).getTime() < maxAgeMs
    })
    const droppedOld = allStories.length - freshStories.length
    if (droppedOld > 0) console.log(`[Scrape] Dropped ${droppedOld} stories older than ${maxAgeDays}d`)

    if (freshStories.length === 0) {
      const cleanup = await runRetentionCleanup(db).catch((e) => {
        console.error('[Scrape] retention cleanup:', e)
        return null
      })
      return NextResponse.json({
        success: true,
        inserted: 0,
        message: 'No fresh stories collected',
        cleanup: cleanup ?? undefined,
      })
    }

    // 2. Deduplicate URLs within this batch
    const seen = new Set<string>()
    const dedupedStories = freshStories.filter((s) => {
      if (seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })

    // 3. Upsert to DB — ignore conflicts on url (already scraped)
    const { data, error } = await db
      .from('raw_stories')
      .upsert(dedupedStories, { onConflict: 'url', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('[Scrape] DB insert error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const inserted = data?.length ?? 0

    // 4. Embed newly inserted stories for vector search (operator OpenAI cost ~$0.002/run)
    // Only embeds rows returned by the upsert (new stories, not pre-existing duplicates)
    if (inserted > 0) {
      try {
        const newIds = data!.map((r) => r.id as string)

        const { data: newRows } = await db
          .from('raw_stories')
          .select('id, title, summary, raw_text')
          .in('id', newIds)

        if (newRows && newRows.length > 0) {
          const texts = newRows.map((r) =>
            [r.title, r.summary, r.raw_text].filter(Boolean).join(' ').slice(0, 2000)
          )

          const vectors = await embedTexts(texts)

          await Promise.all(
            newRows.map((r, i) =>
              vectors[i]
                ? db.from('raw_stories').update({ embedding: vectors[i] }).eq('id', r.id)
                : Promise.resolve()
            )
          )

          console.log(`[Scrape] Embedded ${newRows.length} new stories`)
        }
      } catch (embErr) {
        // Non-fatal — scrape still succeeds; recency fallback handles unembedded stories
        console.warn('[Scrape] Embedding failed (non-fatal):', embErr)
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`[Scrape] Done. Inserted ${inserted} new stories in ${elapsed}s`)

    const cleanup = await runRetentionCleanup(db).catch((e) => {
      console.error('[Scrape] retention cleanup:', e)
      return null
    })

    return NextResponse.json({
      success: true,
      inserted,
      total_collected: freshStories.length,
      dropped_old: droppedOld,
      elapsed_seconds: parseFloat(elapsed),
      breakdown: {
        rss: rssStories.length,
        reddit: redditStories.length,
        hn: hnStories.length,
      },
      cleanup: cleanup ?? undefined,
    })
  } catch (err) {
    console.error('[Scrape] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET for Vercel Cron (same auth as POST)
export async function GET(request: Request) {
  return POST(request)
}
