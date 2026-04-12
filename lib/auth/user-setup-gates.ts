import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { loadUserProfileRow } from '@/lib/user-profiles-db'
import { getDecryptedAnthropicKey } from '@/lib/user-credentials'

export type UserSetupGates = {
  emailVerified: boolean
  hasAnthropicKey: boolean
  hasScoringProfile: boolean
}

export function isEmailVerified(user: User): boolean {
  return Boolean(user.email_confirmed_at)
}

async function loadUserSetupState(user: User) {
  const [anthropicApiKey, row] = await Promise.all([
    getDecryptedAnthropicKey(user.id),
    loadUserProfileRow(user.id),
  ])
  const emailVerified = isEmailVerified(user)
  const hasAnthropicKey = Boolean(anthropicApiKey)
  // Legacy: `onboarding_completed` without `scoring_markdown` (pre–Sonnet synthesis). Remove OR branch once all users have synthesized profiles.
  const hasScoringProfile =
    Boolean(row?.scoring_markdown?.trim()) || Boolean(row?.onboarding_completed)
  return { emailVerified, hasAnthropicKey, hasScoringProfile, anthropicApiKey, row }
}

export async function getUserSetupGates(user: User): Promise<UserSetupGates> {
  const s = await loadUserSetupState(user)
  return {
    emailVerified: s.emailVerified,
    hasAnthropicKey: s.hasAnthropicKey,
    hasScoringProfile: s.hasScoringProfile,
  }
}

/** First missing gate in product order: verify email → BYOK → scoring profile. */
export function nextSetupPath(g: UserSetupGates): '/verify-email' | '/settings' | '/onboarding' | null {
  if (!g.emailVerified) return '/verify-email'
  if (!g.hasAnthropicKey) return '/settings'
  if (!g.hasScoringProfile) return '/onboarding'
  return null
}

export type SetupGateErrorBody = { error: string }

/** Email verified + BYOK + non-empty `scoring_markdown`. Returns the decrypted Anthropic key on success. */
export async function assertUserReadyForPipeline(
  user: User
): Promise<
  | { ok: false; response: NextResponse<SetupGateErrorBody> }
  | { ok: true; anthropicApiKey: string }
> {
  const s = await loadUserSetupState(user)
  if (!s.emailVerified) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'verify_email_first' } satisfies SetupGateErrorBody,
        { status: 403 }
      ),
    }
  }
  if (!s.anthropicApiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Add your Anthropic API key in Settings' } satisfies SetupGateErrorBody,
        { status: 400 }
      ),
    }
  }
  if (!s.hasScoringProfile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'complete_onboarding_first' } satisfies SetupGateErrorBody,
        { status: 403 }
      ),
    }
  }
  return { ok: true, anthropicApiKey: s.anthropicApiKey }
}
