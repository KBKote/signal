import { HomeClient } from '@/components/HomeClient'
import { getSessionUser } from '@/lib/auth/session'

export default async function HomePage() {
  const user = await getSessionUser()
  return <HomeClient isLoggedIn={Boolean(user)} />
}
