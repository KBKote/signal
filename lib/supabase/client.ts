import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from '@/lib/supabase-public-env'

export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabasePublicUrl(), getSupabasePublicAnonKey())
}
