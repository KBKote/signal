import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isEmailVerified } from '@/lib/auth/user-setup-gates'
import { validateCsrfOrigin } from '@/lib/csrf'
import { encryptSecret } from '@/lib/crypto-user-secrets'
import { isPlausibleAnthropicKey } from '@/lib/user-credentials'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  let body: { apiKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!validateCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (!isPlausibleAnthropicKey(apiKey)) {
    return NextResponse.json({ error: 'Invalid Anthropic API key format' }, { status: 400 })
  }

  try {
    const { ciphertext, iv } = encryptSecret(apiKey)
    const { error } = await getSupabaseAdmin().from('user_api_credentials').upsert(
      {
        user_id: user.id,
        anthropic_key_ciphertext: ciphertext,
        anthropic_key_iv: iv,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('[settings/anthropic]', error.message)
      return NextResponse.json({ error: 'Failed to save key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Encryption failed'
    console.error('[settings/anthropic]', msg)
    return NextResponse.json(
      { error: 'Server misconfigured (SECRETS_ENCRYPTION_KEY?)' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  if (!validateCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  const { error } = await getSupabaseAdmin().from('user_api_credentials').delete().eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
