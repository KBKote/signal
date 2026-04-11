'use client'

import { memo, useState } from 'react'

export interface Story {
  id: string
  raw_story_id?: string | null
  title: string
  url: string
  source: string
  summary: string
  category: 'opportunity' | 'idea' | 'intel'
  score: number
  why: string
  published_at: string | null
  scored_at: string
  seen: boolean
  notified?: boolean
}

const CATEGORY_STYLES = {
  opportunity: {
    label: 'Opportunity',
    badge: 'border-white/15 bg-white/5 text-zinc-200',
  },
  idea: {
    label: 'Idea',
    badge: 'border-white/15 bg-white/5 text-zinc-200',
  },
  intel: {
    label: 'Intel',
    badge: 'border-white/15 bg-white/5 text-zinc-200',
  },
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 9
      ? 'bg-white text-black'
      : score >= 7
        ? 'bg-zinc-200 text-black'
        : 'bg-zinc-400 text-black'

  const pulse = score >= 9 ? 'animate-pulse' : ''

  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${color} ${pulse}`}
    >
      {score}
    </span>
  )
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1) return `${h}h ago`
  return `${m}m ago`
}

export const FeedCard = memo(function FeedCard({ story }: { story: Story }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY_STYLES[story.category]

  return (
    <article className="rounded-xl border border-white/10 bg-black/50 p-5 text-zinc-100 backdrop-blur-md transition-colors hover:border-white/20">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 pt-0.5">
          <ScoreBadge score={story.score} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cat.badge}`}>
              {cat.label}
            </span>
            <span className="font-mono text-xs text-zinc-400">{story.source}</span>
            <span className="font-mono text-xs text-zinc-500">
              {timeAgo(story.published_at ?? story.scored_at)}
            </span>
          </div>

          <h2 className="mb-2 font-medium leading-snug text-zinc-50">
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white hover:underline"
            >
              {story.title}
            </a>
          </h2>

          <p className="mb-3 text-sm leading-relaxed text-zinc-400">{story.summary}</p>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {expanded ? '▲ Hide reasoning' : '▼ Why it matters'}
          </button>

          {expanded && (
            <p className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-400">
              {story.why}
            </p>
          )}
        </div>
      </div>
    </article>
  )
})
