/**
 * Prefer IPv4 for DNS on Node (auth API routes only). Mitigates `fetch failed` to
 * `*.supabase.co` when IPv6 answers are broken but IPv4 works.
 */
export async function ensureSupabaseNodeDnsIpv4First(): Promise<void> {
  const g = globalThis as typeof globalThis & { __signalDnsIpv4First?: boolean }
  if (g.__signalDnsIpv4First) return
  g.__signalDnsIpv4First = true
  try {
    const dns = await import('node:dns')
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first')
    }
  } catch {
    // ignore (non-Node, tests)
  }
}
