import { getSupabaseAdmin } from './supabase-server'

export async function loadUserProfileRow(userId: string): Promise<{
  profile: unknown
  onboarding_completed: boolean
} | null> {
  const { data, error } = await getSupabaseAdmin().from('user_profiles')
    .select('profile, onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[user_profiles]', error.message)
    return null
  }
  if (!data) {
    return { profile: {}, onboarding_completed: false }
  }
  return {
    profile: data.profile,
    onboarding_completed: Boolean(data.onboarding_completed),
  }
}
