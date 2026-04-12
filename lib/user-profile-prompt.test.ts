import { describe, expect, it } from 'vitest'
import { buildScoringUserPrompt } from '@/lib/user-profile-prompt'
import { USER_PROFILE } from '@/lib/user-profile'

describe('buildScoringUserPrompt', () => {
  it('returns synthesized markdown only when scoring_markdown is non-empty', () => {
    const md = '# Signal Profile\n\n## Who I Am\nTest user.'
    const out = buildScoringUserPrompt({ background: 'ignored' }, md)
    expect(out).toBe(md)
    expect(out).not.toContain('USER-SPECIFIC CONTEXT')
  })

  it('falls through when markdown is whitespace-only', () => {
    const out = buildScoringUserPrompt({ background: 'x' }, '   \n\t  ')
    expect(out).toContain('USER-SPECIFIC CONTEXT')
    expect(out).toContain('Background / situation: x')
  })

  it('appends legacy questionnaire to USER_PROFILE when no markdown', () => {
    const out = buildScoringUserPrompt(
      { background: 'Building agents', goals: '', avoid: '', experience: 'beginner' },
      null
    )
    expect(out.startsWith(USER_PROFILE.trim())).toBe(true)
    expect(out).toContain('USER-SPECIFIC CONTEXT')
    expect(out).toContain('Background / situation: Building agents')
    expect(out).toContain('Experience level')
  })

  it('returns trimmed USER_PROFILE only when no markdown and empty questionnaire', () => {
    expect(buildScoringUserPrompt({}, undefined)).toBe(USER_PROFILE.trim())
    expect(buildScoringUserPrompt({ background: '  ' }, null)).toBe(USER_PROFILE.trim())
  })
})
