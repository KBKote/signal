import Parser from 'rss-parser'
import sanitizeHtml from 'sanitize-html'
import he from 'he'
import type { RawStory } from './rss'

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Signal/1.0 (personal intelligence feed)' },
})

export const NITTER_INSTANCE_ORIGINS: readonly string[] = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
]

function stripHtml(html: string): string {
  const plain = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  })
  const decoded = he.decode(plain)
  return decoded.replace(/\s+/g, ' ').trim()
}

async function scrapeOneNitterUser(
  username: string,
  matchesText: (text: string) => boolean,
  origins: readonly string[],
  itemsPerAccount: number
): Promise<RawStory[]> {
  const slug = username.toLowerCase()
  const source = `twitter/${slug}`

  for (const origin of origins) {
    const base = origin.replace(/\/$/, '')
    const feedUrl = `${base}/${slug}/rss`
    try {
      const parsed = await parser.parseURL(feedUrl)
      const stories: RawStory[] = []

      for (const item of parsed.items.slice(0, itemsPerAccount)) {
        const rawTitle = item.title?.trim() ?? ''
        const url = item.link?.trim() ?? ''
        if (!rawTitle || !url) continue

        // Strip "RT @username: " prefix, then strip bare URLs (t.co links etc.)
        // and truncate so the raw tweet text isn't used verbatim as a headline.
        const stripped = rawTitle
          .replace(/^RT @\w+:\s*/i, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
        const title = stripped.length > 140 ? stripped.slice(0, 137) + '…' : stripped || rawTitle

        const bodyRaw = item.contentSnippet ?? item.content ?? item.summary ?? ''
        const raw_text = stripHtml(bodyRaw).slice(0, 2000)

        if (!matchesText(title + ' ' + raw_text)) continue

        stories.push({
          title,
          url,
          source,
          raw_text,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        })
      }

      console.log(`[Nitter] ${source}: fetched ${parsed.items.length} items`)
      return stories
    } catch (err) {
      console.error(`[Nitter] ${username} @ ${origin}:`, err)
    }
  }

  throw new Error(`[Nitter] all instances failed for ${username}`)
}

export async function scrapeNitterAccounts(
  usernames: readonly string[],
  matchesText: (text: string) => boolean,
  options?: { instanceOrigins?: readonly string[]; itemsPerAccount?: number }
): Promise<RawStory[]> {
  const origins = options?.instanceOrigins ?? NITTER_INSTANCE_ORIGINS
  const itemsPerAccount = options?.itemsPerAccount ?? 20

  const settled = await Promise.allSettled(
    usernames.map((u) => scrapeOneNitterUser(u, matchesText, origins, itemsPerAccount))
  )

  const results: RawStory[] = []
  settled.forEach((entry, idx) => {
    if (entry.status === 'fulfilled') {
      results.push(...entry.value)
      return
    }

    console.error(`[Nitter] Failed for user ${usernames[idx]}:`, entry.reason)
  })

  return results
}
