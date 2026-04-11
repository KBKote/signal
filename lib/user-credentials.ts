import { decryptSecret } from './crypto-user-secrets'
import { getSupabaseAdmin } from './supabase-server'

export async function getDecryptedAnthropicKey(userId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().from('user_api_credentials')
    .select('anthropic_key_ciphertext, anthropic_key_iv')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  try {
    return decryptSecret(data.anthropic_key_ciphertext, data.anthropic_key_iv)
  } catch {
    return null
  }
}

export function isPlausibleAnthropicKey(key: string): boolean {
  const t = key.trim()
  return t.startsWith('sk-ant-') && t.length > 20
}
