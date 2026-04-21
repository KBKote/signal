import { REDDIT_BASE, type RedditSubDef } from '../scrape-sources'
import type { RawStory } from './rss'

interface RedditPost {
  data: {
    title: string
    url: string
    selftext: string
    score: number
    permalink: string
    created_utc: number
  }
}

export async function scrapeReddit(
  subreddits: RedditSubDef[] = REDDIT_BASE
): Promise<RawStory[]> {
  const settled = await Promise.allSettled(
    subreddits.map(async (sub): Promise<RawStory[]> => {
      const res = await fetch(`https://www.reddit.com/r/${sub.name}/${sub.sort}&limit=25`, {
        headers: {
          'User-Agent': 'Signal/1.0 (personal intelligence feed)',
        },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(8_000),
      })

      if (!res.ok) {
        console.error(`[Reddit] r/${sub.name} returned ${res.status}`)
        return []
      }

      const json = await res.json()
      const posts: RedditPost[] = json?.data?.children ?? []
      const stories: RawStory[] = []

      for (const post of posts) {
        const { title, url, selftext, score, permalink, created_utc } = post.data

        if (score < 10) continue

        const canonicalUrl = url.startsWith('https://www.reddit.com')
          ? `https://www.reddit.com${permalink}`
          : url

        const raw_text = selftext
          ? selftext.slice(0, 2000)
          : `Reddit post from r/${sub.name} with ${score} upvotes.`

        stories.push({
          title: title.trim(),
          url: canonicalUrl,
          source: `reddit/${sub.name}`,
          raw_text,
          published_at: new Date(created_utc * 1000).toISOString(),
        })
      }

      console.log(`[Reddit] r/${sub.name}: fetched ${posts.length} posts`)
      return stories
    })
  )

  const results: RawStory[] = []
  settled.forEach((entry, idx) => {
    if (entry.status === 'fulfilled') {
      results.push(...entry.value)
      return
    }

    console.error(`[Reddit] Failed to fetch r/${subreddits[idx]?.name}:`, entry.reason)
  })

  return results
}
