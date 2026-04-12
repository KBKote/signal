import { redirect } from 'next/navigation'
import { MarketingBody } from '@/components/MarketingBody'
import { getSessionUser } from '@/lib/auth/session'
import { getServerPostAuthDestination } from '@/lib/auth/post-auth-redirect-server'

export default async function HomePage() {
  const user = await getSessionUser()
  if (user) {
    const path = await getServerPostAuthDestination(user)
    redirect(path)
  }

  return <MarketingBody />
}
