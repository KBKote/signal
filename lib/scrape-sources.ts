/**
 * Topic-aware scrape configuration: extra feeds, subreddits, and HN search
 * so a macro/stock emphasis does not rely only on CoinDesk-style crypto/AI URLs.
 */
import { sanitizeTopicCustom, type PipelinePreferences } from '@/lib/pipeline-preferences'

export type RssFeedDef = { url: string; source: string }
export type RedditSubDef = { name: string; sort: string }

/** Default pool (AI × crypto skew) — always included. */
/* Dead/unreachable feeds (as of 2026-04-21) — omitted or substituted:
 * - https://blog.ethereum.org/en/rss.xml (404) → https://blog.ethereum.org/feed.xml
 * - https://research.paradigm.xyz/feed (525) → https://feeds.feedburner.com/paradigm
 * - https://defillama.com/news/feed (403)
 * - https://blog.uniswap.org/rss.xml (404) → https://medium.com/feed/uniswap
 * - https://a16zcrypto.com/feed/ (404) — no working replacement
 * - https://newsletter.banklesshq.com/feed (TLS cert error) → https://www.bankless.com/rss/feed
 * - https://www.dlnews.com/feed/ (404) → https://www.dlnews.com/rss/
 * - https://openai.com/blog/rss/ (403) → https://openai.com/news/rss.xml
 * - https://www.anthropic.com/news.rss (404) — no public RSS available
 */
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
  { url: 'https://www.bankless.com/rss/feed', source: 'bankless' },
  { url: 'https://www.dlnews.com/rss/', source: 'dl-news' },
  { url: 'https://protos.com/feed/', source: 'protos' },
  { url: 'https://blog.chain.link/feed/', source: 'chainlink-blog' },
  { url: 'https://www.theblock.co/rss.xml', source: 'the-block' },
  { url: 'https://simonwillison.net/atom/everything/', source: 'simon-willison' },
  { url: 'https://www.interconnects.ai/feed', source: 'interconnects' },
  { url: 'https://www.semianalysis.com/feed', source: 'semianalysis' },
  { url: 'https://openai.com/news/rss.xml', source: 'openai-blog' },
  { url: 'https://bair.berkeley.edu/blog/feed.xml', source: 'bair' },
  { url: 'https://newsletter.pragmaticengineer.com/feed', source: 'pragmatic-engineer' },
  { url: 'https://blog.ethereum.org/feed.xml', source: 'ethereum-foundation' },
  { url: 'https://feeds.feedburner.com/paradigm', source: 'paradigm-research' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'techcrunch-ai' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'venturebeat-ai' },
  { url: 'https://github.blog/feed/', source: 'github-blog' },
  { url: 'https://medium.com/feed/uniswap', source: 'uniswap-blog' },
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
  { name: 'solidity', sort: 'top.json?t=day' },
  { name: 'web3', sort: 'hot.json' },
  { name: 'MEV', sort: 'top.json?t=day' },
  { name: 'Bitcoin', sort: 'hot.json' },
  { name: 'CryptoCurrency', sort: 'hot.json' },
  // AI agents and MCP — always relevant
  { name: 'AIAgents', sort: 'hot.json' },
  { name: 'agentdevelopment', sort: 'hot.json' },
  { name: 'mcp_ai', sort: 'hot.json' },
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

const RSS_ETHEREUM: RssFeedDef[] = [{ url: 'https://blog.ethereum.org/feed.xml', source: 'ethereum-blog' }]

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

// AI builder / vibe coding — practitioner content, tools, and techniques
const RSS_AI_DEV: RssFeedDef[] = [
  // Practitioner newsletters & blogs
  { url: 'https://www.latent.space/feed', source: 'latent-space' },
  { url: 'https://buttondown.com/ainews/rss', source: 'ai-news-daily' },
  { url: 'https://lilianweng.github.io/lil-log/feed.xml', source: 'lil-log' },
  { url: 'https://hamel.dev/index.xml', source: 'hamel-dev' },
  { url: 'https://every.to/chain-of-thought/feed', source: 'chain-of-thought' },
  { url: 'https://changelog.com/practicalai/feed', source: 'practical-ai' },
  // Framework & tool blogs
  { url: 'https://blog.langchain.dev/rss/', source: 'langchain-blog' },
  { url: 'https://thenewstack.io/feed/', source: 'the-new-stack' },
  { url: 'https://about.sourcegraph.com/blog/rss.xml', source: 'sourcegraph-blog' },
  { url: 'https://research.google/blog/rss/', source: 'google-research' },
  { url: 'https://martinfowler.com/feed.atom', source: 'martin-fowler' },
  { url: 'https://www.aisnakeoil.com/feed', source: 'ai-snake-oil' },
  // Dev.to tags — tutorials and how-tos by practitioners
  { url: 'https://dev.to/feed/tag/aiagents', source: 'devto-aiagents' },
  { url: 'https://dev.to/feed/tag/llm', source: 'devto-llm' },
  { url: 'https://dev.to/feed/tag/machinelearning', source: 'devto-ml' },
  { url: 'https://dev.to/feed/tag/claudeai', source: 'devto-claude' },
  // Medium tags — longer-form practitioner write-ups
  { url: 'https://medium.com/feed/tag/ai-agents', source: 'medium-ai-agents' },
  { url: 'https://medium.com/feed/tag/llm', source: 'medium-llm' },
  { url: 'https://medium.com/feed/tag/prompt-engineering', source: 'medium-prompts' },
  // New tools & launches
  { url: 'https://www.producthunt.com/feed', source: 'product-hunt' },
  // Research papers (cs.AI + cs.LG) — latest techniques
  { url: 'https://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai' },
  { url: 'https://export.arxiv.org/rss/cs.LG', source: 'arxiv-ml' },
]

const REDDIT_AI_DEV: RedditSubDef[] = [
  { name: 'vibecoding', sort: 'hot.json' },
  { name: 'ChatGPTCoding', sort: 'hot.json' },
  { name: 'ClaudeAI', sort: 'hot.json' },
  { name: 'Cursor', sort: 'hot.json' },
  { name: 'PromptEngineering', sort: 'top.json?t=day' },
  { name: 'LLMDevs', sort: 'hot.json' },
  { name: 'n8n', sort: 'hot.json' },
  { name: 'AutoGPT', sort: 'hot.json' },
  { name: 'AIToolsTech', sort: 'hot.json' },
  { name: 'LLMstudio', sort: 'hot.json' },
  { name: 'openai', sort: 'hot.json' },
  { name: 'perplexity_ai', sort: 'hot.json' },
]

const HN_QUERY_AI_DEV =
  '(MCP OR "model context protocol" OR "vibe coding" OR "AI agent" OR "agent framework" OR cursor OR aider OR "copilot" OR RAG OR "retrieval augmented" OR langchain OR llamaindex OR "tool use" OR "function calling" OR "prompt engineering" OR "fine-tuning" OR "fine tuning" OR embeddings OR "code generation" OR "AI coding" OR "AI assistant" OR "local LLM" OR ollama OR litellm OR "open source model")'

const RSS_DEV: RssFeedDef[] = [
  { url: 'https://github.blog/feed/', source: 'github-blog' },
]

const REDDIT_DEV: RedditSubDef[] = [
  { name: 'programming', sort: 'hot.json' },
  { name: 'webdev', sort: 'hot.json' },
  { name: 'rust', sort: 'top.json?t=day' },
  { name: 'golang', sort: 'top.json?t=day' },
]

/** Fixed discovery subs for `topicMode: other` (no dynamic token → subreddit mapping). */
const REDDIT_OTHER_DISCOVERY: RedditSubDef[] = [
  { name: 'news', sort: 'hot.json' },
  { name: 'worldnews', sort: 'hot.json' },
  { name: 'technology', sort: 'hot.json' },
  { name: 'investing', sort: 'hot.json' },
  { name: 'startups', sort: 'hot.json' },
]

/** General-purpose RSS sources to support arbitrary `topicMode: other`. */
const RSS_OTHER_DISCOVERY: RssFeedDef[] = [
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'ars-technica' },
  { url: 'https://www.theverge.com/rss/index.xml', source: 'the-verge' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'nytimes-technology' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc-world' },
  { url: 'http://feeds.bbci.co.uk/news/business/rss.xml', source: 'bbc-business' },
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

export type ScrapePack = {
  rssFeeds: RssFeedDef[]
  subreddits: RedditSubDef[]
  hnQuery: string
}

export function getScrapePack(prefs: PipelinePreferences): ScrapePack {
  let rss = [...RSS_FEEDS_BASE]
  let subs = [...REDDIT_BASE]
  let hnQuery = HN_QUERY_DEFAULT

  switch (prefs.topicMode) {
    case 'intersection':
      break
    case 'macro_markets':
      rss = uniqByUrl([...rss, ...RSS_MACRO])
      subs = uniqSubs([...subs, ...REDDIT_MACRO])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_MACRO}`
      break
    case 'ethereum_defi':
      rss = uniqByUrl([...rss, ...RSS_ETHEREUM])
      subs = uniqSubs([...subs, ...REDDIT_ETHEREUM])
      break
    case 'ai_ml':
      rss = uniqByUrl([...rss, ...RSS_AI])
      subs = uniqSubs([...subs, ...REDDIT_AI])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_AI}`
      break
    case 'ai_dev':
      rss = uniqByUrl([...rss, ...RSS_AI_DEV, ...RSS_AI])
      subs = uniqSubs([...subs, ...REDDIT_AI_DEV, ...REDDIT_AI])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_AI} OR ${HN_QUERY_AI_DEV}`
      break
    case 'developer':
      rss = uniqByUrl([...rss, ...RSS_DEV])
      subs = uniqSubs([...subs, ...REDDIT_DEV])
      hnQuery = `${HN_QUERY_DEFAULT} OR ${HN_QUERY_DEV}`
      break
    case 'other': {
      const tokens = tokensFromCustom(prefs.topicCustom).map((w) => w.replace(/[^a-z0-9]/gi, '')).filter(Boolean)
      if (tokens.length > 0) {
        const q = tokens.slice(0, 6).join(' ')
        const qOr = tokens.slice(0, 8).join(' OR ')
        const qQuoted = tokens.length >= 2 ? `"${tokens.slice(0, 2).join(' ')}"` : q

        rss = uniqByUrl([
          ...rss,
          ...RSS_OTHER_DISCOVERY,
          // Multiple Google News queries to increase recall for arbitrary topics
          {
            url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
            source: 'google-news-custom-and',
          },
          {
            url: `https://news.google.com/rss/search?q=${encodeURIComponent(qOr)}&hl=en-US&gl=US&ceid=US:en`,
            source: 'google-news-custom-or',
          },
          {
            url: `https://news.google.com/rss/search?q=${encodeURIComponent(qQuoted)}&hl=en-US&gl=US&ceid=US:en`,
            source: 'google-news-custom-phrase',
          },
        ])

        subs = uniqSubs([...subs, ...REDDIT_OTHER_DISCOVERY])

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
  }
}

export const NITTER_USERNAMES: readonly string[] = [
  'VitalikButerin',
  'gakonst',
  'hasufl',
  'sassal0x',
  'banteg',
  'samczsun',
  'bertcmiller',
  'philogy',
  'loomdart',
  'dcbuilder0x',
  'StaniKulechov',
  'AndreCronjeTech',
  'cdixon',
  'balajis',
  'karpathy',
  'emollick',
  'awilkinson',
  'ercwl',
  'ryanSAdams',
  'ameensoleimani',
  'TrustlessState',
  'ChristineDKim',
  '0xMaki',
  'tarunchitra',
  'nickbytes',
]
