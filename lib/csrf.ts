import { getTrustedOriginAllowlist } from '@/lib/trusted-origin'

function normalizeRequestOrigin(origin: string): string {
  const t = origin.trim()
  try {
    return new URL(t).origin
  } catch {
    return t.replace(/\/+$/, '')
  }
}

export function validateCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // server-component / same-origin requests omit Origin

  const norm = normalizeRequestOrigin(origin)
  const extras: string[] = ['http://localhost:3000', 'http://127.0.0.1:3000']
  const vercelHost = process.env.VERCEL_URL?.trim()
  if (vercelHost) {
    try {
      extras.push(new URL(`https://${vercelHost}`).origin)
    } catch {
      /* ignore */
    }
  }

  const allowed = new Set<string>([...getTrustedOriginAllowlist(), ...extras])
  return [...allowed].some((a) => norm === a)
}
