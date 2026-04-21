import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { assertUserReadyForPipeline } from '@/lib/auth/user-setup-gates'
import { computePoolStateCounts } from '@/lib/filter'

export const maxDuration = 30

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ready = await assertUserReadyForPipeline(user)
  if (!ready.ok) return ready.response

  try {
    const counts = await computePoolStateCounts(user.id)
    return NextResponse.json({ success: true, ...counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to compute pool state'
    console.error('[/api/pool-state] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

