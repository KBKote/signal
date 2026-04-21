import { HN_QUERY_DEFAULT } from '../scrape-sources'
import type { RawStory } from './rss'

const MIN_POINTS = 15

interface HNHit {
  objectID: string
  title: string
  url?: string
  story_text?: string
  points: number
  created_at: string
}

export async function scrapeHackerNews(
  query: string = HN_QUERY_DEFAULT
): Promise<RawStory[]> {
  const results: RawStory[] = []

  try {
    const params = new URLSearchParams({
      query,
      tags: 'story',
      numericFilters: `points>=${MIN_POINTS}`,
      hitsPerPage: '100',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${params}`, {
        next: { revalidate: 0 },
        signal: controller.signal,
      })

      if (!res.ok) {
        console.error(`[HN] Algolia API returned ${res.status}`)
        return results
      }

      const json = await res.json()
      const hits: HNHit[] = json?.hits ?? []

      for (const hit of hits) {
        const title = hit.title?.trim() ?? ''
        const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`

        if (!title) continue

        const raw_text = hit.story_text
          ? hit.story_text.replace(/<[^>]*>/g, ' ').slice(0, 2000)
          : `Hacker News story with ${hit.points} points.`

        results.push({
          title,
          url,
          source: 'hacker-news',
          raw_text,
          published_at: hit.created_at,
        })
      }

      console.log(`[HN] Fetched ${hits.length} stories, kept ${results.length}`)
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    console.error('[HN] Failed to fetch:', err)
  }

  return results
}
