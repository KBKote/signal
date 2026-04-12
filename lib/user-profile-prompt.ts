import { USER_PROFILE } from './user-profile'

export type OnboardingProfileV1 = {
  background?: string
  goals?: string
  avoid?: string
  experience?: string
}

export function parseOnboardingProfile(raw: unknown): OnboardingProfileV1 {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  return {
    background: typeof o.background === 'string' ? o.background : undefined,
    goals: typeof o.goals === 'string' ? o.goals : undefined,
    avoid: typeof o.avoid === 'string' ? o.avoid : undefined,
    experience: typeof o.experience === 'string' ? o.experience : undefined,
  }
}

/**
 * Full scoring preamble: synthesized markdown (preferred), else static defaults plus legacy onboarding JSON (if any).
 */
export function buildScoringUserPrompt(
  profileJson: unknown,
  scoringMarkdown?: string | null
): string {
  const md = typeof scoringMarkdown === 'string' ? scoringMarkdown.trim() : ''
  if (md) return md

  const p = parseOnboardingProfile(profileJson)
  const hasCustom = [p.background, p.goals, p.avoid, p.experience].some((x) => x && x.trim())

  if (!hasCustom) {
    return USER_PROFILE.trim()
  }

  const lines = [
    USER_PROFILE.trim(),
    '',
    'USER-SPECIFIC CONTEXT (from onboarding questionnaire — use alongside the profile above):',
  ]
  if (p.background?.trim()) lines.push(`Background / situation: ${p.background.trim()}`)
  if (p.goals?.trim()) lines.push(`Goals & what to prioritize: ${p.goals.trim()}`)
  if (p.avoid?.trim()) lines.push(`Topics or angles to deprioritize: ${p.avoid.trim()}`)
  if (p.experience?.trim()) lines.push(`Experience level (for tone of "why"): ${p.experience.trim()}`)

  return lines.join('\n')
}
