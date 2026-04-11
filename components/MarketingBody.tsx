'use client'

import Link from 'next/link'
import { ShaderAnimation } from '@/components/ui/shader-animation'

/** Public product overview — shader background, Log in / Sign up CTAs. */
export function MarketingBody() {
  return (
    <main className="relative isolate flex min-h-dvh w-full overflow-hidden bg-black px-5 py-16 text-white">
      <ShaderAnimation />
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">Signal</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white md:text-5xl">
          Personal intelligence for builders
        </h1>
        <p className="mt-5 text-lg text-white/80">
          Signal collects open-web tech, AI, and crypto stories (RSS, Reddit, Hacker News), then scores them with
          Claude Haiku against a profile tuned to you—so you see opportunities and ideas worth acting on, not an
          endless feed.
        </p>
        <p className="mt-4 text-sm text-white/65">
          You add your own Anthropic API key (encrypted in our database). We host the app, database, and scrapers with
          operator keys—nothing except your AI key lives in your hands.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login?mode=signin"
            className="rounded-full border border-white/25 bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Log in
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-full border border-white/40 bg-transparent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  )
}
