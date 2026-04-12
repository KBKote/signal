import webpush from 'web-push'
import { getSupabaseAdmin } from './supabase-server'

function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  const priv = process.env.VAPID_PRIVATE_KEY ?? ''
  if (!pub || !priv) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@signal.app',
    pub,
    priv
  )
}

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface ScoredStory {
  id: string
  title: string
  url: string
  score: number
  category: string
  why: string
  scored_at: string
}

/**
 * Notify this user's subscriptions about their new high-signal opportunities.
 */
export async function sendNotificationsForNewStories(userId: string): Promise<number> {
  configureWebPush()
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || !process.env.VAPID_PRIVATE_KEY?.trim()) {
    return 0
  }
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
  const db = getSupabaseAdmin()

  const { data: stories, error: storiesError } = await db
    .from('scored_stories')
    .select('id, title, url, score, category, why, scored_at')
    .eq('user_id', userId)
    .gte('score', 9)
    .eq('category', 'opportunity')
    .gte('scored_at', twoHoursAgo)
    .eq('notified', false)

  if (storiesError || !stories || stories.length === 0) return 0

  const { data: subs, error: subsError } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (subsError || !subs || subs.length === 0) return 0

  let sent = 0
  const sentIds: string[] = []
  const allFailedEndpoints: string[] = []

  for (const story of stories as ScoredStory[]) {
    const payload = JSON.stringify({
      title: `🔴 Signal: ${story.title}`,
      body: story.why,
      url: story.url,
    })

    let anyDeliveryOk = false

    for (const sub of subs) {
      const pushSub: PushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }

      try {
        await webpush.sendNotification(pushSub, payload)
        sent++
        anyDeliveryOk = true
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          allFailedEndpoints.push(sub.endpoint)
        }
      }
    }

    if (anyDeliveryOk) {
      sentIds.push(story.id)
    }
  }

  if (sentIds.length > 0) {
    const { error: upErr } = await db.from('scored_stories').update({ notified: true }).in('id', sentIds)
    if (upErr) {
      console.error('[notifications] batch update notified:', upErr.message)
    }
  }

  if (allFailedEndpoints.length > 0) {
    const uniqueEndpoints = [...new Set(allFailedEndpoints)]
    const { error: delErr } = await db
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('endpoint', uniqueEndpoints)
    if (delErr) {
      console.error('[notifications] batch delete stale subscriptions:', delErr.message)
    }
  }

  return sent
}
