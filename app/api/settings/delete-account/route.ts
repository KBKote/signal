import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { validateCsrfOrigin } from '@/lib/csrf'
import { getSupabaseAdmin } from '@/lib/supabase-server'

const TABLES = [
  'push_subscriptions',
  'api_usage',
  'user_api_credentials',
  'user_raw_scored',
  'scored_stories',
  'user_profiles',
] as const

export async function DELETE(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!validateCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const userId = user.id

  for (const table of TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error) {
      console.error(`[settings/delete-account] ${table}`, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) {
    console.error('[settings/delete-account] auth.admin.deleteUser', authErr.message)
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
