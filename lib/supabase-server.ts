import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicUrl } from '@/lib/supabase-public-env'

let cached: SupabaseClient | null = null

/**
 * Lazily creates the service-role client so `next build` can import this module without
 * env vars; the first DB call throws if keys are missing.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const url = getSupabasePublicUrl()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  cached = createClient(url, key)
  return cached
}
