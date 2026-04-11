import { getDecryptedAnthropicKey } from '@/lib/user-credentials'

/** Same routing rules as client `destinationFromSetup`, without a fetch round-trip. */
export async function getServerPostAuthDestination(userId: string): Promise<string> {
  const key = await getDecryptedAnthropicKey(userId)
  if (!key) return '/settings'
  return '/feed'
}
