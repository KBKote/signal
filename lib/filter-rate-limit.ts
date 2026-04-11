import { getSupabaseAdmin } from '@/lib/supabase-server'

/** Minimum spacing between filter runs per user (protects BYOK spend on mis-clicks / loops). */
const MIN_INTERVAL_MS = 90_000

export async function takeFilterRateSlotDb(userId: string): Promise<string | null> {
  const db = getSupabaseAdmin()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const { data: row, error: selErr } = await db
    .from('filter_user_throttle')
    .select('last_filter_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (selErr) {
    const m = (selErr.message ?? '').toLowerCase()
    if (m.includes('filter_user_throttle') || m.includes('schema cache') || m.includes('does not exist')) {
      console.warn('[filter-rate-limit] table missing; run migration. Allowing filter.', selErr.message)
      return null
    }
    console.error('[filter-rate-limit] select:', selErr.message)
    return null
  }

  if (row?.last_filter_at) {
    const prev = new Date(row.last_filter_at as string).getTime()
    if (Number.isFinite(prev) && now - prev < MIN_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - prev)) / 1000)
      return `Wait ${waitSec}s before running the filter again.`
    }
  }

  const { error: upErr } = await db
    .from('filter_user_throttle')
    .upsert({ user_id: userId, last_filter_at: nowIso }, { onConflict: 'user_id' })

  if (upErr) {
    console.error('[filter-rate-limit] upsert:', upErr.message)
    return null
  }

  return null
}
