import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { appendAgentLog } from '@/lib/debug/agent-log-server'
import { ensureSupabaseNodeDnsIpv4First } from '@/lib/supabase-node-dns-ipv4-first'
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from '@/lib/supabase-public-env'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  await ensureSupabaseNodeDnsIpv4First()
  await appendAgentLog({
    sessionId: 'd9c924',
    hypothesisId: 'H-server',
    location: 'app/api/auth/sign-in/route.ts',
    message: 'enter',
  })

  const supabaseUrl = getSupabasePublicUrl()
  const supabaseAnon = getSupabasePublicAnonKey()
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(
      { error: 'Server is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
      { status: 500 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    await appendAgentLog({
      sessionId: 'd9c924',
      hypothesisId: 'H-server',
      location: 'sign-in',
      message: 'invalid_json',
    })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const email = typeof o?.email === 'string' ? o.email.trim() : ''
  const password = typeof o?.password === 'string' ? o.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnon,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const msg = error.message ?? ''
    const looksLikeUpstreamNetwork =
      msg === 'fetch failed' ||
      /ECONNREFUSED|ENOTFOUND|network|NetworkError|Failed to fetch/i.test(msg)
    await appendAgentLog({
      sessionId: 'd9c924',
      hypothesisId: 'H-server',
      location: 'sign-in',
      message: looksLikeUpstreamNetwork ? 'sign_in_upstream_network' : 'sign_in_supabase_error',
      data: { code: error.code ?? null, msgLen: msg.length },
    })
    if (looksLikeUpstreamNetwork) {
      return NextResponse.json(
        { error: 'Could not reach Supabase from the app server. Check NEXT_PUBLIC_SUPABASE_URL and outbound network.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  await appendAgentLog({
    sessionId: 'd9c924',
    hypothesisId: 'H-server',
    location: 'sign-in',
    message: 'sign_in_ok',
    runId: 'post-fix',
  })
  return NextResponse.json({ ok: true })
}
