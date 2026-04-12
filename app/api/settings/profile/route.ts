import { NextResponse } from 'next/server'
import sanitizeHtml from 'sanitize-html'
import { getSessionUser } from '@/lib/auth/session'
import { isEmailVerified } from '@/lib/auth/user-setup-gates'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { loadUserProfileRow } from '@/lib/user-profiles-db'

export const dynamic = 'force-dynamic'

const MAX_MARKDOWN_CHARS = 4000

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  const row = await loadUserProfileRow(user.id)
  return NextResponse.json({
    scoring_markdown: row?.scoring_markdown ?? null,
  })
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw =
    body && typeof body === 'object' && typeof (body as { scoring_markdown?: unknown }).scoring_markdown === 'string'
      ? (body as { scoring_markdown: string }).scoring_markdown
      : null

  if (raw === null) {
    return NextResponse.json({ error: 'scoring_markdown string required' }, { status: 400 })
  }

  const stripped = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} })
  if (stripped.length > MAX_MARKDOWN_CHARS) {
    return NextResponse.json(
      { error: `scoring_markdown must be at most ${MAX_MARKDOWN_CHARS} characters` },
      { status: 400 }
    )
  }

  const db = getSupabaseAdmin()
  const existing = await loadUserProfileRow(user.id)
  const profile =
    existing?.profile && typeof existing.profile === 'object' ? existing.profile : {}
  const onboarding_completed = existing?.onboarding_completed ?? true
  const now = new Date().toISOString()

  const { error } = await db.from('user_profiles').upsert(
    {
      user_id: user.id,
      profile,
      onboarding_completed,
      scoring_markdown: stripped,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[settings/profile]', error.message)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
