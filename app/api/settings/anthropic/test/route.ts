import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { isEmailVerified } from '@/lib/auth/user-setup-gates'
import { getDecryptedAnthropicKey } from '@/lib/user-credentials'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: 'verify_email_first' }, { status: 403 })
  }

  const apiKey = await getDecryptedAnthropicKey(user.id)
  if (!apiKey) {
    return NextResponse.json({ error: 'add_key_first' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Anthropic request failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
