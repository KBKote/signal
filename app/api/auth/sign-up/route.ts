import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkAuthRateLimit } from '@/lib/auth-rate-limit'
import { appendAgentLog } from '@/lib/debug/agent-log-server'
import { ensureSupabaseNodeDnsIpv4First } from '@/lib/supabase-node-dns-ipv4-first'
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from '@/lib/supabase-public-env'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  await ensureSupabaseNodeDnsIpv4First()
  await appendAgentLog({
    sessionId: 'd9c924',
    hypothesisId: 'H-server',
    location: 'app/api/auth/sign-up/route.ts',
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const email = typeof o?.email === 'string' ? o.email.trim() : ''
  const password = typeof o?.password === 'string' ? o.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }

  const allowed = await checkAuthRateLimit(email)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait 15 minutes before trying again.' },
      { status: 429 }
    )
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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://devsignal.space/auth/callback',
    },
  })
  if (error) {
    const msg = error.message ?? ''
    const looksLikeUpstreamNetwork =
      msg === 'fetch failed' ||
      /ECONNREFUSED|ENOTFOUND|network|NetworkError|Failed to fetch/i.test(msg)
    await appendAgentLog({
      sessionId: 'd9c924',
      hypothesisId: 'H-server',
      location: 'sign-up',
      message: looksLikeUpstreamNetwork ? 'sign_up_upstream_network' : 'sign_up_supabase_error',
      data: { code: error.code ?? null },
    })
    if (looksLikeUpstreamNetwork) {
      return NextResponse.json(
        { error: 'Could not reach Supabase from the app server. Check NEXT_PUBLIC_SUPABASE_URL and outbound network.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await appendAgentLog({
    sessionId: 'd9c924',
    hypothesisId: 'H-server',
    location: 'sign-up',
    message: 'sign_up_ok',
    runId: 'post-fix',
    data: { hasSession: Boolean(data.session) },
  })

  return NextResponse.json({ ok: true, hasSession: Boolean(data.session) })
}
