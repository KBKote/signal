import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'What is Dev Signal? — Dev Signal',
  description: 'Dev Signal: why it was built, what it does, and how to use it.',
}

export default function AboutPage() {
  return (
    <main className="relative isolate min-h-dvh bg-black px-5 py-12 text-zinc-100 md:px-8">
      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl">
        {/* Nav */}
        <div className="mb-12 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-white transition hover:text-zinc-300"
          >
            Dev Signal
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        {/* Header */}
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">About</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          What is Dev Signal?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-400">
          A personal feed that reads the internet for you — and only shows you the things worth acting on.
        </p>

        <div className="mt-12 space-y-12">
          {/* Why it was built */}
          <section>
            <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
              The problem
            </h2>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
              <p className="text-base leading-relaxed text-zinc-300">
                Every day, dozens of useful opportunities go unnoticed. A new Ethereum testnet with
                airdrop potential. An open-source model release that could power your next project. A
                protocol vulnerability that shifts market dynamics before anyone prices it in.
              </p>
              <p className="mt-4 text-base leading-relaxed text-zinc-300">
                Not because the information isn't public. It is. It's buried in hundreds of RSS feeds,
                Reddit threads, Hacker News posts, and forum discussions that nobody has time to
                actually read.
              </p>
              <p className="mt-4 text-base leading-relaxed text-zinc-300">
                Dev Signal was built to fix this. I got tired of missing things I should have seen.
              </p>
            </div>
          </section>

          {/* What it does */}
          <section>
            <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
              What it does
            </h2>
            <div className="space-y-3">
              {[
                {
                  n: '01',
                  title: 'Reads the internet',
                  body: '26 RSS feeds, 19 subreddits, and Hacker News — all the technical and crypto sources worth watching, pulled into one pool.',
                },
                {
                  n: '02',
                  title: 'Scores against your profile',
                  body: 'Claude AI reads every story and scores it against your specific background — your experience level, what you\'re building, what ecosystem you\'re in, and what you want to filter out.',
                },
                {
                  n: '03',
                  title: 'Surfaces what matters',
                  body: 'You get a filtered feed sorted by signal strength. Not an endless scroll. Just the things worth acting on, learning from, or keeping an eye on.',
                },
              ].map((item) => (
                <div
                  key={item.n}
                  className="flex gap-5 rounded-2xl border border-white/8 bg-white/[0.03] p-5"
                >
                  <span className="font-mono text-xs text-zinc-700 pt-0.5">{item.n}</span>
                  <div>
                    <p className="font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How to use it */}
          <section>
            <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
              How to use it
            </h2>
            <div className="space-y-3">
              {[
                {
                  step: '1',
                  title: 'Create an account and add your API key',
                  body: 'Sign up, then paste your Anthropic API key in Settings. It\'s encrypted and only ever used by you.',
                },
                {
                  step: '2',
                  title: 'Answer a quick questionnaire',
                  body: 'Tell Dev Signal what you\'re building, what ecosystems you care about, what to always surface, and what to ignore. This takes about 2 minutes.',
                },
                {
                  step: '3',
                  title: 'Hit Run Pipeline',
                  body: 'Dev Signal scores the current story pool against your profile. Your feed populates in about 30 seconds.',
                },
                {
                  step: '4',
                  title: 'Browse your feed',
                  body: 'Stories are tagged as Opportunities (act on this week), Ideas (things worth building), or Intel (context to have). Run again anytime to catch new stories.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex gap-5 rounded-2xl border border-white/8 bg-white/[0.03] p-5"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 font-mono text-[10px] text-zinc-400">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Categories */}
          <section>
            <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
              How stories are categorized
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Opportunity</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Something you can act on this week. A testnet to join, a grant to apply for, a
                  build opportunity with a first-mover window.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-sky-700">Idea</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  A technical pattern, tooling gap, or integration angle worth exploring in your
                  current project.
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Intel</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Ecosystem context that shapes where the next opportunity will emerge. Worth
                  knowing, not necessarily acting on.
                </p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-7 text-center">
            <p className="text-base font-medium text-zinc-100">Ready to stop missing things?</p>
            <p className="mt-2 text-sm text-zinc-500">
              Free to use. You bring your own Anthropic API key — typical usage costs a few cents per
              run.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login?mode=signup"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
              >
                Get started
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              >
                Read the docs
              </Link>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t border-white/8 pt-8 text-center">
          <Link href="/" className="text-sm text-zinc-600 transition hover:text-zinc-400">
            ← Back to Dev Signal
          </Link>
        </div>
      </div>
    </main>
  )
}
