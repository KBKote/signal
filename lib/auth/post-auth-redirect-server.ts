import type { User } from '@supabase/supabase-js'
import { getUserSetupGates, nextSetupPath } from '@/lib/auth/user-setup-gates'

/** Same routing rules as client `destinationFromSetup`, without a fetch round-trip. */
export async function getServerPostAuthDestination(user: User): Promise<string> {
  const gates = await getUserSetupGates(user)
  const next = nextSetupPath(gates)
  if (next) return next
  return '/feed'
}
