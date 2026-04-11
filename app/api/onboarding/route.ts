import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { loadUserProfileRow } from '@/lib/user-profiles-db'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const row = await loadUserProfileRow(user.id)
  return NextResponse.json({
    profile: row?.profile ?? {},
    onboarding_completed: row?.onboarding_completed ?? false,
  })
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    profile?: Record<string, unknown>
    onboarding_completed?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {}
  const onboarding_completed =
    typeof body.onboarding_completed === 'boolean' ? body.onboarding_completed : true

  const { error } = await getSupabaseAdmin().from('user_profiles').upsert(
    {
      user_id: user.id,
      profile,
      onboarding_completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[onboarding]', error.message)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
