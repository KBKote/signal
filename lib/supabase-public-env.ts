/** NEXT_PUBLIC_* is inlined in client bundles; trim avoids subtle .env copy/paste failures. */
export function getSupabasePublicUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
}

export function getSupabasePublicAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
}
