'use client'

import { useRouter } from 'next/navigation'
import { LayoutDashboard, Info, BookOpen, LogIn, UserPlus } from 'lucide-react'
import { FloatingActionMenu } from '@/components/FloatingActionMenu'
import { ShaderAnimation } from '@/components/ui/shader-animation'

export function HomeClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter()

  const loggedInOptions = [
    {
      label: 'Open App',
      onClick: () => router.push('/feed'),
      Icon: <LayoutDashboard className="h-3.5 w-3.5 text-emerald-400" />,
    },
    {
      label: 'What is Dev Signal?',
      onClick: () => router.push('/about'),
      Icon: <Info className="h-3.5 w-3.5 text-sky-400" />,
    },
    {
      label: 'Docs',
      onClick: () => router.push('/docs'),
      Icon: <BookOpen className="h-3.5 w-3.5 text-zinc-400" />,
    },
  ]

  const loggedOutOptions = [
    {
      label: 'Log in',
      onClick: () => router.push('/login?mode=signin'),
      Icon: <LogIn className="h-3.5 w-3.5 text-emerald-400" />,
    },
    {
      label: 'Sign up',
      onClick: () => router.push('/login?mode=signup'),
      Icon: <UserPlus className="h-3.5 w-3.5 text-sky-400" />,
    },
    {
      label: 'What is Dev Signal?',
      onClick: () => router.push('/about'),
      Icon: <Info className="h-3.5 w-3.5 text-zinc-400" />,
    },
    {
      label: 'Docs',
      onClick: () => router.push('/docs'),
      Icon: <BookOpen className="h-3.5 w-3.5 text-zinc-400" />,
    },
  ]

  return (
    <main className="relative isolate flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-black">
      <ShaderAnimation />

      {/* Grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      {/* Wordmark */}
      <div className="relative z-10 select-none text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-white/20">
          Personal intelligence
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white md:text-6xl">
          Dev Signal
        </h1>
        <p className="mt-3 font-mono text-xs text-white/25">
          {isLoggedIn ? 'tap + to continue' : 'tap + to get started'}
        </p>
      </div>

      <FloatingActionMenu options={isLoggedIn ? loggedInOptions : loggedOutOptions} />
    </main>
  )
}
