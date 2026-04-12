/**
 * Topic-aware scrape configuration: extra feeds, subreddits, HN search, and keyword prefilter
 * so a macro/stock emphasis does not rely only on CoinDesk-style crypto/AI URLs.
 */
import { sanitizeTopicCustom, type PipelinePreferences } from '@/lib/pipeline-preferences'
import { matchesSignalKeywords } from '@/lib/user-profile'

export type RssFeedDef = { url: string; source: string }
export type RedditSubDef = { name: string; sort: string }

/** Default pool (AI × crypto skew) — always included. */
export const RSS_FEEDS_BASE: RssFeedDef[] = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'coindesk' },
  { url: 'https://decrypt.co/feed', source: 'decrypt' },
  { url: 'https://thedefiant.io/feed', source: 'the-defiant' },
  { url: 'https://weekinethereumnews.com/feed/', source: 'week-in-ethereum' },
  { url: 'https://blockworks.co/feed', source: 'blockworks' },
  { url: 'https://www.theverge.com/rss/index.xml', source: 'the-verge' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'ars-technica' },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'huggingface' },
  { url: 'https://cointelegraph.com/rss', source: 'cointelegraph' },
  { url: 'https://a16zcrypto.com/feed/', source: 'a16z-crypto' },
  { url: 'https://newsletter.banklesshq.com/feed', source: 'bankless' },
  { url: 'https://www.dlnews.com/feed/', source: 'dl-news' },
  { url: 'https://protos.com/feed/', source: 'protos' },
  { url: 'https://blog.chain.link/feed/', source: 'chainlink-blog' },
  { url: 'https://www.theblock.co/rss.xml', source: 'the-block' },
  { url: 'https://simonwillison.net/atom/everything/', source: 'simon-willison' },
  { url: 'https://www.interconnects.ai/feed', source: 'interconnects' },
  { url: 'https://www.semianalysis.com/feed', source: 'semianalysis' },
  { url: 'https://openai.com/blog/rss/', source: 'openai-blog' },
  { url: 'https://www.anthropic.com/news.rss', source: 'anthropic-news' },
  { url: 'https://bair.berkeley.edu/blog/feed.xml', source: 'bair' },
  { url: 'https://newsletter.pragmaticengineer.com/feed', source: 'pragmatic-engineer' },
]

export const REDDIT_BASE: RedditSubDef[] = [
  { name: 'ethereum', sort: 'top.json?t=day' },
  { name: 'defi', sort: 'top.json?t=day' },
  { name: 'MachineLearning', sort: 'top.json?t=day' },
  { name: 'LocalLLaMA', sort: 'top.json?t=day' },
  { name: 'cryptocurrency', sort: 'hot.json' },
  { name: 'ethdev', sort: 'top.json?t=day' },
  { name: 'ZeroKnowledge', sort: 'top.json?t=day' },
  { name: 'LangChain', sort: 'hot.json' },
  { name: 'OpenAI', sort: 'hot.json' },
  { name: 'algotrading', sort: 'top.json?t=day' },
  { name: 'CryptoTechnology', sort: 'top.json?t=day' },
]

const RSS_MACRO: RssFeedDef[] = [
  { url: 'http://feeds.bbci.co.uk/news/business/rss.xml', source: 'bbc-business' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'yahoo-finance' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'cnbc-top' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
]

const REDDIT_MACRO: RedditSubDef[] = [
  { name: 'investing', sort: 'hot.json' },
  { name: 'stocks', sort: 'hot.json' },
  { name: 'MacroEconomics', sort: 'top.json?t=day' },
  { name: 'economy', sort: 'top.json?t=day' },
  { name: 'SecurityAnalysis', sort: 'top.json?t=day' },
]

const RSS_ETHEREUM: RssFeedDef[] = [{ url: 'https://blog.ethereum.org/en/rss.xml', source: 'ethereum-blog' }]

const REDDIT_ETHEREUM: RedditSubDef[] = [
  { name: 'ethfinance', sort: 'hot.json' },
  { name: 'ethstaker', sort: 'top.json?t=day' },
  { name: 'rethfinance', sort: 'hot.json' },
]

const RSS_AI: RssFeedDef[] = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'techcrunch-ai' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'venturebeat-ai' },
]

const REDDIT_AI: RedditSubDef[] = [
  { name: 'artificial', sort: 'hot.json' },
  { name: 'singularity', sort: 'top.json?t=day' },
  { name: 'ChatGPT', sort: 'hot.json' },
]

const RSS_DEV: RssFeedDef[] = [
  { url: 'https://github.blog/feed/', source: 'github-blog' },
]

const REDDIT_DEV: RedditSubDef[] = [
  { name: 'programming', sort: 'hot.json' },
  { name: 'webdev', sort: 'hot.json' },
  { name: 'rust', sort: 'top.json?t=day' },
  { name: 'golang', sort: 'top.json?t=day' },
]

/** Default HN Algolia `query` — also used when topic is intersection-only. */
export const HN_QUERY_DEFAULT =
  'AI OR "machine learning" OR ethereum OR crypto OR DeFi OR LLM OR "language model" OR anthropic OR openai OR "zero knowledge" OR zkEVM OR "smart contract" OR solidity OR "AI agent" OR inference'

const HN_QUERY_MACRO =
  '(fed OR FOMC OR inflation OR treasury OR earnings OR IPO OR "stock market" OR GDP OR recession OR "interest rate" OR forex OR commodity OR bitcoin OR ethereum)'

const HN_QUERY_AI =
  '(LLM OR "machine learning" OR openai OR anthropic OR inference OR pytorch OR tensorflow OR "language model" OR agent OR GPU)'

const HN_QUERY_DEV =
  '(kubernetes OR rust OR golang OR typescript OR API OR SDK OR postgres OR linux OR security OR "open source")'

/** Macro / equities / policy — widens beyond pure on-chain keywords. */
const KEYWORDS_MACRO: string[] = [
  'fed ',
  ' fomc',
  'treasury',
  'yield',
  'bond',
  'equity',
  'equities',
  's&p',
  'sp500',
  'nasdaq',
  'dow jones',
  'gdp',
  'inflation',
  'cpi',
  'pce',
  'recession',
  'earnings',
  ' ipo',
  'macro',
  'liquidity',
  'rate hike',
  'rate cut',
  'forex',
  'fx ',
  'commodit',
  'sovereign',
  'credit ',
  'bank of',
  'central bank',
  'sec ',
  'etf',
  'dividend',
  'shareholder',
  'stock ',
  'stocks',
  'trader',
  'portfolio',
  'valuation',
  'merger',
  'acquisition',
]

const KEYWORDS_AI_EXTRA: string[] = [
  'pytorch',
  'tensorflow',
  'jax ',
  'cuda',
  'eval',
  'benchmark',
  'multimodal',
  'fine-tun',
  'weights',
  'gpu',
  'inference',
]

const KEYWORDS_DEV_EXTRA: string[] = [
  'kubernetes',
  'docker',
  'postgres',
  'typescript',
  'react ',
  'next.js',
  'api ',
  'sdk',
  'observability',
  'ci/cd',
  'linux',
]

function uniqByUrl(feeds: RssFeedDef[]): RssFeedDef[] {
  const seen = new Set<string>()
  const out: RssFeedDef[] = []
  for (const f of feeds) {
    if (seen.has(f.url)) continue
    seen.add(f.url)
    out.push(f)
  }
  return out
}

function uniqSubs(subs: RedditSubDef[]): RedditSubDef[] {
  const seen = new Set<string>()
  const out: RedditSubDef[] = []
  for (const s of subs) {
    if (seen.has(s.name)) continue
    seen.add(s.name)
    out.push(s)
  }
  return out
}

function tokensFromCustom(custom: string): string[] {
  const t = sanitizeTopicCustom(custom).toLowerCase()
  const parts = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 3)
  return [...new Set(parts)].slice(0, 28)
}

function buildKeywordMatcher(supplemental: string[]): (text: string) => boolean {
  const extra = supplemental.map((k) => k.toLowerCase())
  return (text: string) => {
    if (matchesSignalKeywords(text)) return true
    const lower = text.toLowerCase()
    return extra.some((k) => lower.includes(k))
  }
}

export type ScrapePack = {
  rssFeeds: RssFeedDef[]
  subreddits: RedditSubDef[]
  hnQuery: string
  matchesText: (text: string) => boolean
}

export function getScrapePack(prefs: PipelinePreferences): ScrapePack {
  let rss = [...RSS_FEEDS_BASE]
  let subs = [...REDDIT_BASE]
  let hnQuery = HN_QUERY_DEFAULT
  let supplemental: string[] = []

  switch (prefs.topicMode) {
    case 'intersection':
      break
    case 'macro_markets':
      rss = uniqByUrl([...rss, ...RSS_MACRO])
      subs = uniqSubs([...subs, ...REDDIT_MACRO])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_MACRO}`
      supplemental = KEYWORDS_MACRO
      break
    case 'ethereum_defi':
      rss = uniqByUrl([...rss, ...RSS_ETHEREUM])
      subs = uniqSubs([...subs, ...REDDIT_ETHEREUM])
      break
    case 'ai_ml':
      rss = uniqByUrl([...rss, ...RSS_AI])
      subs = uniqSubs([...subs, ...REDDIT_AI])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_AI}`
      supplemental = KEYWORDS_AI_EXTRA
      break
    case 'developer':
      rss = uniqByUrl([...rss, ...RSS_DEV])
      subs = uniqSubs([...subs, ...REDDIT_DEV])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_DEV}`
      supplemental = KEYWORDS_DEV_EXTRA
      break
    case 'other': {
      const tokens = tokensFromCustom(prefs.topicCustom).map((w) => w.replace(/[^a-z0-9]/gi, '')).filter(Boolean)
      supplemental = tokens
      if (tokens.length > 0) {
        const q = tokens.slice(0, 6).join(' ')
        rss = uniqByUrl([
          ...rss,
          {
            url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
            source: 'google-news-custom',
          },
        ])
        const hnTokens = tokens.slice(0, 8).filter((t) => t.length >= 3)
        hnQuery =
          hnTokens.length > 0 ? `${HN_QUERY_DEFAULT} OR (${hnTokens.join(' OR ')})` : HN_QUERY_DEFAULT
      }
      break
    }
    default:
      break
  }

  return {
    rssFeeds: rss,
    subreddits: subs,
    hnQuery,
    matchesText: buildKeywordMatcher(supplemental),
  }
}
