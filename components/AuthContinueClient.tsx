'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { resolvePostAuthPath } from '@/lib/auth/post-auth-navigation'

export function AuthContinueClient({ redirectParam }: { redirectParam: string | null }) {
  const router = useRouter()
  const [message, setMessage] = useState('Setting up your session…')

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/')
          return
        }
        const next = await resolvePostAuthPath(redirectParam)
        router.replace(next)
      } catch {
        setMessage('Something went wrong. Try logging in again.')
      }
    })()
  }, [redirectParam, router])

  return (
    <main className="signal-wrdlss-shell signal-hero-bg flex min-h-full items-center justify-center px-5 py-16">
      <p className="text-sm text-zinc-400">{message}</p>
    </main>
  )
}
