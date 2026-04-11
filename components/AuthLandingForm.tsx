'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { resolvePostAuthPath } from '@/lib/auth/post-auth-navigation'

type Mode = 'signin' | 'signup'

/**
 * Tab state is driven by the URL (`?mode=signup` or default sign-in) so switching always works
 * and matches deep links from the marketing page — no useEffect resync that fights local state.
 */
export function AuthLandingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const mode: Mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  const redirectParam = searchParams.get('redirect')
  const urlError = searchParams.get('error')

  function switchMode(next: Mode) {
    const p = new URLSearchParams(searchParams.toString())
    if (next === 'signup') {
      p.set('mode', 'signup')
    } else {
      p.delete('mode')
    }
    const qs = p.toString()
    router.replace(qs ? `/login?${qs}` : '/login', { scroll: false })
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setBusy(true)

    const supabase = createSupabaseBrowserClient()
    const em = email.trim()

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password,
        })

        if (error) {
          setMessage(error.message)
          return
        }

        if (data.session) {
          const next = await resolvePostAuthPath(redirectParam)
          window.location.assign(next)
          return
        }

        setMessage(
          'Check your email to confirm your account, then sign in. (You can disable email confirmation in Supabase Auth settings for local dev.)'
        )
        switchMode('signin')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email: em, password })
      if (error) {
        setMessage(error.message)
        return
      }

      const next = await resolvePostAuthPath(redirectParam)
      window.location.assign(next)
      return
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 p-8 text-zinc-100 shadow-xl backdrop-blur-xl">
      <div className="relative z-0 flex gap-2 rounded-xl border border-white/10 bg-black/40 p-1">
        <button
          type="button"
          onClick={() => {
            switchMode('signin')
            setMessage('')
          }}
          className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === 'signin' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => {
            switchMode('signup')
            setMessage('')
          }}
          className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === 'signup' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Sign up
        </button>
      </div>

      <p className="mt-6 font-mono text-xs text-zinc-500">
        {mode === 'signin' ? 'Welcome back' : 'Create your account'}
      </p>
      <h2 className="mt-1 font-serif text-2xl tracking-tight text-zinc-50">
        {mode === 'signin' ? 'Log in' : 'Sign up'}
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Email and password are stored by Supabase. Next you&apos;ll add your Anthropic API key in Settings, then you can
        open your feed.
      </p>

      {urlError === 'auth' ? (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          Sign-in failed. Try again or request a new confirmation email from Supabase.
        </p>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="auth-email" className="block font-mono text-xs text-zinc-400">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/35"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block font-mono text-xs text-zinc-400">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/35"
            placeholder="At least 6 characters"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl border border-white/20 bg-white py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Log in' : 'Create account'}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">{message}</p>
      ) : null}
    </div>
  )
}
