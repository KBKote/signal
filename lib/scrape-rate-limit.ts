import { getSupabaseAdmin } from '@/lib/supabase-server'

const MIN_INTERVAL_MS = 120_000

/**
 * Persists last scrape time per user so rate limiting survives serverless cold starts.
 */
export async function takeScrapeRateSlotDb(userId: string): Promise<string | null> {
  const db = getSupabaseAdmin()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const { data: row, error: selErr } = await db
    .from('scrape_user_throttle')
    .select('last_scrape_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (selErr) {
    const m = (selErr.message ?? '').toLowerCase()
    if (m.includes('scrape_user_throttle') || m.includes('schema cache') || m.includes('does not exist')) {
      console.warn('[scrape-rate-limit] table missing; run migration. Allowing scrape.', selErr.message)
      return null
    }
    console.error('[scrape-rate-limit] select:', selErr.message)
    return null
  }

  if (row?.last_scrape_at) {
    const prev = new Date(row.last_scrape_at as string).getTime()
    if (Number.isFinite(prev) && now - prev < MIN_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - prev)) / 1000)
      return `Wait ${waitSec}s before running scrape again.`
    }
  }

  const { error: upErr } = await db
    .from('scrape_user_throttle')
    .upsert({ user_id: userId, last_scrape_at: nowIso }, { onConflict: 'user_id' })

  if (upErr) {
    console.error('[scrape-rate-limit] upsert:', upErr.message)
    return null
  }

  return null
}
