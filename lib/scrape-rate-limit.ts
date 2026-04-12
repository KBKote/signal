import { getSupabaseAdmin } from '@/lib/supabase-server'

const MIN_INTERVAL_MS = 120_000

/**
 * Persists last scrape time per user so rate limiting survives serverless cold starts.
 */
export async function takeScrapeRateSlotDb(userId: string): Promise<string | null> {
  const db = getSupabaseAdmin()

  const { data: allowed, error: rpcErr } = await db.rpc('take_scrape_rate_slot', {
    p_user_id: userId,
    p_min_interval_ms: MIN_INTERVAL_MS,
  })

  if (rpcErr) {
    const m = (rpcErr.message ?? '').toLowerCase()
    if (m.includes('take_scrape_rate_slot') || m.includes('does not exist')) {
      console.warn('[scrape-rate-limit] RPC missing; run migration. Allowing.')
      return null
    }
    console.error('[scrape-rate-limit] rpc:', rpcErr.message)
    return null
  }

  if (allowed === false) {
    return `Please wait before running the scrape again.`
  }

  return null
}
