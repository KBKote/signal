import type { SupabaseClient } from '@supabase/supabase-js'

function daysEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/**
 * Deletes old rows so the shared pool and per-user tables stay bounded.
 * Order: scored_stories, user_raw_scored, then raw_stories (FK-safe).
 */
export async function runRetentionCleanup(admin: SupabaseClient): Promise<{ ok: boolean }> {
  const rawDays = daysEnv('RAW_STORIES_RETENTION_DAYS', 14)
  const userRawDays = daysEnv('USER_RAW_SCORED_RETENTION_DAYS', 90)
  const scoredDays = daysEnv('SCORED_STORIES_RETENTION_DAYS', 14)

  const rawCutoff = isoDaysAgo(rawDays)
  const userRawCutoff = isoDaysAgo(userRawDays)
  const scoredCutoff = isoDaysAgo(scoredDays)

  const { error: scoredDelErr } = await admin.from('scored_stories').delete().lt('scored_at', scoredCutoff)
  if (scoredDelErr) console.error('[cleanup] scored_stories:', scoredDelErr.message)

  const { error: urDelErr } = await admin.from('user_raw_scored').delete().lt('scored_at', userRawCutoff)
  if (urDelErr) console.error('[cleanup] user_raw_scored:', urDelErr.message)

  const { error: rawDelErr } = await admin.from('raw_stories').delete().lt('scraped_at', rawCutoff)
  if (rawDelErr) console.error('[cleanup] raw_stories:', rawDelErr.message)

  return { ok: !scoredDelErr && !urDelErr && !rawDelErr }
}
