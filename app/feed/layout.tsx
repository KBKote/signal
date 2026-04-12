import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getUserSetupGates, nextSetupPath } from '@/lib/auth/user-setup-gates'

export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login?redirect=/feed')
  }
  const gates = await getUserSetupGates(user)
  const next = nextSetupPath(gates)
  if (next) {
    redirect(next)
  }
  return <>{children}</>
}
