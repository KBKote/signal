import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { takeScrapeRateSlotDb } from '@/lib/scrape-rate-limit'

/**
 * Production scrape access:
 * - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) — no session required, no user rate limit.
 * - Signed-in user — rate-limited (`takeScrapeRateSlotDb`); does not expose CRON_SECRET to the browser.
 * - Development — unrestricted (no secret required).
 */
export async function scrapeAccessDeniedResponse(request: Request): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') {
    return null
  }

  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get('authorization')
  if (secret && auth === `Bearer ${secret}`) {
    return null
  }

  const user = await getSessionUser()
  if (user) {
    const rateMsg = await takeScrapeRateSlotDb(user.id)
    if (rateMsg) {
      return NextResponse.json({ success: false, error: rateMsg }, { status: 429 })
    }
    return null
  }

  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Sign in to scrape from the app, or set CRON_SECRET for scheduled (cron) scrapes.',
      },
      { status: 503 }
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Sign in to run scrape from the app, or use a valid cron Authorization header.',
    },
    { status: 401 }
  )
}
