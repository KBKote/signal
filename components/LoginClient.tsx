'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { AuthLandingForm } from '@/components/AuthLandingForm'

function AuthFormFallback() {
  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 p-8 text-zinc-200 shadow-xl backdrop-blur-xl">
      <p className="text-sm text-zinc-500">Loading…</p>
    </div>
  )
}

export function LoginClient() {
  return (
    <main className="signal-wrdlss-shell signal-hero-bg flex min-h-full items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <Suspense fallback={<AuthFormFallback />}>
          <AuthLandingForm />
        </Suspense>
        <p className="mt-8 text-center text-xs text-zinc-500">
          <Link href="/" className="underline decoration-white/25 underline-offset-2 hover:text-zinc-200">
            About Signal
          </Link>
        </p>
      </div>
    </main>
  )
}
