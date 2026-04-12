/**
 * Client-side: where to send a signed-in user based on setup progress.
 * Order: verified email → BYOK → scoring profile (`scoring_markdown`) → feed.
 */
export type SetupStatus = {
  emailVerified: boolean
  hasAnthropicKey: boolean
  hasScoringProfile: boolean
}

export async function fetchSetupStatus(): Promise<SetupStatus | null> {
  const r = await fetch('/api/settings/status', { credentials: 'include' })
  if (r.status === 401) return null
  if (!r.ok) return null
  const j = (await r.json()) as SetupStatus
  return {
    emailVerified: Boolean(j.emailVerified),
    hasAnthropicKey: Boolean(j.hasAnthropicKey),
    hasScoringProfile: Boolean(j.hasScoringProfile),
  }
}

export function destinationFromSetup(s: SetupStatus | null): string {
  if (!s) return '/settings'
  if (!s.emailVerified) return '/verify-email'
  if (!s.hasAnthropicKey) return '/settings'
  if (!s.hasScoringProfile) return '/onboarding'
  return '/feed'
}

/** After full setup, honor ?redirect= if it is a same-origin path. */
export function safeRedirectTarget(redirectParam: string | null | undefined): string | null {
  if (!redirectParam || !redirectParam.startsWith('/') || redirectParam.startsWith('//')) {
    return null
  }
  return redirectParam
}

/**
 * Assumes the browser already has a valid session (e.g. after password sign-in or callback).
 * If the status API fails, send the user into setup at `/settings` (avoids redirect loops on `/`).
 */
export async function resolvePostAuthPath(redirectParam: string | null | undefined): Promise<string> {
  const status = await fetchSetupStatus()
  if (status === null) return '/settings'
  const dest = destinationFromSetup(status)
  if (dest !== '/feed') return dest
  return safeRedirectTarget(redirectParam) ?? '/feed'
}
