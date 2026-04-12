import { getSupabaseAdmin } from '@/lib/supabase-server'

const MAX_ATTEMPTS = 10
const WINDOW_SECONDS = 300 // 5 min window
const BLOCK_SECONDS = 900 // 15 min block

export async function checkAuthRateLimit(email: string): Promise<boolean> {
  const identifier = `auth:${email.toLowerCase().trim()}`
  try {
    const { data, error } = await getSupabaseAdmin().rpc('check_auth_rate_limit', {
      p_identifier: identifier,
      p_max_attempts: MAX_ATTEMPTS,
      p_window_seconds: WINDOW_SECONDS,
      p_block_seconds: BLOCK_SECONDS,
    })
    if (error) {
      const m = (error.message ?? '').toLowerCase()
      if (m.includes('check_auth_rate_limit') || m.includes('does not exist')) {
        return true // migration not applied yet — allow
      }
      console.error('[auth-rate-limit]', error.message)
      return true // fail open so users aren't locked out on DB error
    }
    return data === true
  } catch {
    return true
  }
}
