function normalizeOrigin(origin: string): string {
  const t = origin.trim().replace(/\/+$/, '')
  try {
    return new URL(t).origin
  } catch {
    try {
      return new URL(`https://${t}`).origin
    } catch {
      return t.toLowerCase()
    }
  }
}

function parseTrustedOriginsList(): string[] {
  const raw = process.env.TRUSTED_ORIGINS
  const fromList = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((o) => normalizeOrigin(o))
    : []

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const canonical = site ? normalizeOrigin(site) : null

  const out: string[] = []
  const seen = new Set<string>()
  if (canonical) {
    seen.add(canonical)
    out.push(canonical)
  }
  for (const o of fromList) {
    if (!seen.has(o)) {
      seen.add(o)
      out.push(o)
    }
  }
  return out
}

/**
 * In production, only allow redirect targets that match TRUSTED_ORIGINS / NEXT_PUBLIC_SITE_URL.
 * Otherwise fall back to the canonical site URL (first in allowlist). Development returns candidate unchanged.
 */
export function resolveRedirectOrigin(candidate: string, requestUrlForFallback: string): string {
  if (process.env.NODE_ENV === 'development') {
    return candidate
  }

  const allowed = parseTrustedOriginsList()
  const normCandidate = normalizeOrigin(candidate)

  for (const a of allowed) {
    if (a === normCandidate) {
      return a
    }
  }

  if (allowed.length > 0) {
    return allowed[0]
  }

  try {
    return new URL(requestUrlForFallback).origin
  } catch {
    return '/'
  }
}
