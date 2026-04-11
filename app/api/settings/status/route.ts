import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { loadUserProfileRow } from '@/lib/user-profiles-db'
import { getDecryptedAnthropicKey } from '@/lib/user-credentials'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [key, profileRow] = await Promise.all([
    getDecryptedAnthropicKey(user.id),
    loadUserProfileRow(user.id),
  ])

  return NextResponse.json({
    hasAnthropicKey: Boolean(key),
    onboardingCompleted: profileRow?.onboarding_completed ?? false,
  })
}
