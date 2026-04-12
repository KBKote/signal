import { getSupabaseAdmin } from '@/lib/supabase-server'

/** Minimum spacing between filter runs per user (protects BYOK spend on mis-clicks / loops). */
const MIN_INTERVAL_MS = 90_000

export async function takeFilterRateSlotDb(userId: string): Promise<string | null> {
  const db = getSupabaseAdmin()

  const { data: allowed, error: rpcErr } = await db.rpc('take_filter_rate_slot', {
    p_user_id: userId,
    p_min_interval_ms: MIN_INTERVAL_MS,
  })

  if (rpcErr) {
    const m = (rpcErr.message ?? '').toLowerCase()
    if (m.includes('take_filter_rate_slot') || m.includes('does not exist')) {
      console.warn('[filter-rate-limit] RPC missing; run migration. Allowing.')
      return null
    }
    console.error('[filter-rate-limit] rpc:', rpcErr.message)
    return null
  }

  if (allowed === false) {
    return `Please wait before running the filter again.`
  }

  return null
}
