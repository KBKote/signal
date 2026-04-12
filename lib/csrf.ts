export function validateCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // server-component / same-origin requests omit Origin
  const allowed = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'http://localhost:3000',
  ]
    .filter(Boolean)
    .map((o) => o!.replace(/\/$/, ''))
  return allowed.some((a) => origin === a || origin.startsWith(a))
}
