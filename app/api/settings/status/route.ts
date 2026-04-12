import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { getUserSetupGates } from '@/lib/auth/user-setup-gates'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const gates = await getUserSetupGates(user)

  return NextResponse.json({
    emailVerified: gates.emailVerified,
    hasAnthropicKey: gates.hasAnthropicKey,
    hasScoringProfile: gates.hasScoringProfile,
    /** @deprecated use hasScoringProfile — kept for older clients */
    onboardingCompleted: gates.hasScoringProfile,
  })
}
