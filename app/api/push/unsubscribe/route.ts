import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { assertUserReadyForPipeline } from '@/lib/auth/user-setup-gates'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ready = await assertUserReadyForPipeline(user)
  if (!ready.ok) return ready.response

  try {
    const { endpoint } = await req.json()

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
