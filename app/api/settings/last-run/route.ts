import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isEmailVerified } from '@/lib/auth/user-setup-gates'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('api_usage')
    .select('run_at, input_tokens, output_tokens, estimated_cost, stories_scored')
    .eq('user_id', user.id)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[settings/last-run]', error.message)
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ lastRun: null })
  }

  return NextResponse.json({
    lastRun: {
      run_at: data.run_at,
      input_tokens: data.input_tokens,
      output_tokens: data.output_tokens,
      estimated_cost: data.estimated_cost,
      stories_scored: data.stories_scored,
    },
  })
}
