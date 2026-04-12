import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { isEmailVerified } from '@/lib/auth/user-setup-gates'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login?redirect=/settings')
  }
  if (!isEmailVerified(user)) {
    redirect('/verify-email')
  }
  return <>{children}</>
}
