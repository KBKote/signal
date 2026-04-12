import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getUserSetupGates, nextSetupPath } from '@/lib/auth/user-setup-gates'
import { VerifyEmailClient } from './VerifyEmailClient'

export default async function VerifyEmailPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login?redirect=/verify-email')
  }
  if (user.email_confirmed_at) {
    const gates = await getUserSetupGates(user)
    const next = nextSetupPath(gates)
    redirect(next ?? '/feed')
  }
  return <VerifyEmailClient email={user.email ?? ''} />
}
