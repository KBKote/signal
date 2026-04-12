import { getSupabaseAdmin } from './supabase-server'

export async function loadUserProfileRow(userId: string): Promise<{
  profile: unknown
  onboarding_completed: boolean
  scoring_markdown: string | null
  questionnaire_answers: unknown | null
  synthesized_at: string | null
} | null> {
  const { data, error } = await getSupabaseAdmin().from('user_profiles')
    .select(
      'profile, onboarding_completed, scoring_markdown, questionnaire_answers, synthesized_at'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[user_profiles]', error.message)
    return null
  }
  if (!data) {
    return {
      profile: {},
      onboarding_completed: false,
      scoring_markdown: null,
      questionnaire_answers: null,
      synthesized_at: null,
    }
  }
  return {
    profile: data.profile,
    onboarding_completed: Boolean(data.onboarding_completed),
    scoring_markdown:
      typeof data.scoring_markdown === 'string' ? data.scoring_markdown : null,
    questionnaire_answers: data.questionnaire_answers ?? null,
    synthesized_at:
      typeof data.synthesized_at === 'string' ? data.synthesized_at : null,
  }
}
