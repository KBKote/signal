import Parser from 'rss-parser'
import sanitizeHtml from 'sanitize-html'
import he from 'he'
import { RSS_FEEDS_BASE, type RssFeedDef } from '../scrape-sources'

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Signal/1.0 (personal intelligence feed)' },
})

export interface RawStory {
  title: string
  url: string
  source: string
  raw_text: string
  published_at: string | null
}

function stripHtml(html: string): string {
  const plain = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  })
  const decoded = he.decode(plain)
  return decoded.replace(/\s+/g, ' ').trim()
}

export async function scrapeRssFeeds(
  feeds: RssFeedDef[] = RSS_FEEDS_BASE
): Promise<RawStory[]> {
  const settled = await Promise.allSettled(
    feeds.map(async (feed): Promise<RawStory[]> => {
      const parsed = await parser.parseURL(feed.url)
      const stories: RawStory[] = []

      for (const item of parsed.items.slice(0, 20)) {
        const title = item.title?.trim() ?? ''
        const url = item.link?.trim() ?? ''
        if (!title || !url) continue

        const bodyRaw = item.contentSnippet ?? item.content ?? item.summary ?? ''
        const raw_text = stripHtml(bodyRaw).slice(0, 2000)

        stories.push({
          title,
          url,
          source: feed.source,
          raw_text,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        })
      }

      console.log(`[RSS] ${feed.source}: fetched ${parsed.items.length} items`)
      return stories
    })
  )

  const results: RawStory[] = []
  settled.forEach((entry, idx) => {
    if (entry.status === 'fulfilled') {
      results.push(...entry.value)
      return
    }

    console.error(`[RSS] Failed to fetch ${feeds[idx]?.source}:`, entry.reason)
  })

  return results
}
