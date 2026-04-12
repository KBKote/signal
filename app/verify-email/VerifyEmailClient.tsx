'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function VerifyEmailClient({ email }: { email: string }) {
  const [resendMsg, setResendMsg] = useState('')
  const [resending, setResending] = useState(false)

  async function resend() {
    setResendMsg('')
    if (!email) return
    setResending(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    setResending(false)
    if (error) {
      setResendMsg(error.message)
      return
    }
    setResendMsg('Check your inbox for a new confirmation link.')
  }

  return (
    <main className="signal-wrdlss-shell signal-hero-bg px-5 py-12 md:py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-black/70 p-8 text-zinc-100 shadow-xl backdrop-blur-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Signal</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-zinc-50">Verify your email</h1>
        <p className="mt-3 text-sm text-zinc-400">
          We sent a confirmation link to <span className="text-zinc-200">{email || 'your address'}</span>. Open it
          on this device or any device where you are signed in — then use the button below to continue.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-white/20 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            I have verified — continue
          </button>
          <button
            type="button"
            disabled={resending || !email}
            onClick={() => void resend()}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>
        </div>
        {resendMsg ? <p className="mt-4 text-sm text-zinc-400">{resendMsg}</p> : null}
        <p className="mt-8 text-center text-sm text-zinc-500">
          <Link href="/login" className="text-zinc-300 underline hover:text-white">
            Sign out
          </Link>
        </p>
      </div>
    </main>
  )
}
