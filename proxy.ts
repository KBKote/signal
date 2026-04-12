import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicOrigin } from '@/lib/request-origin'
import { getSupabasePublicAnonKey, getSupabasePublicUrl } from '@/lib/supabase-public-env'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    getSupabasePublicUrl(),
    getSupabasePublicAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const login = new URL('/login', getPublicOrigin(request))
    login.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(login)
  }

  if (!user.email_confirmed_at) {
    const path = request.nextUrl.pathname
    if (path.startsWith('/verify-email')) {
      return supabaseResponse
    }
    return NextResponse.redirect(new URL('/verify-email', getPublicOrigin(request)))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/feed/:path*', '/onboarding/:path*', '/settings/:path*', '/verify-email'],
}
