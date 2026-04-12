import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { assertUserReadyForPipeline } from '@/lib/auth/user-setup-gates'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Clears this user's scoring progress so the next filter run re-scores from the shared raw pool
 * with current pipeline preferences. Deletes `scored_stories` and `user_raw_scored` for the user only.
 */
export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ready = await assertUserReadyForPipeline(user)
  if (!ready.ok) return ready.response

  const { error: scoredErr } = await getSupabaseAdmin().from('scored_stories').delete().eq('user_id', user.id)
  if (scoredErr) {
    console.error('[reset-progress] scored_stories:', scoredErr.message)
    return NextResponse.json({ error: 'Failed to clear feed stories' }, { status: 500 })
  }

  const { error: rawErr } = await getSupabaseAdmin().from('user_raw_scored').delete().eq('user_id', user.id)
  if (rawErr) {
    console.error('[reset-progress] user_raw_scored:', rawErr.message)
    return NextResponse.json({ error: 'Failed to clear scoring progress' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
