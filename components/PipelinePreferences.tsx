'use client'

import {
  DEFAULT_PIPELINE_PREFS,
  SCOPES,
  TOPIC_CUSTOM_MAX_LEN,
  TOPIC_MODES,
  TOPIC_MODE_LABELS,
  SCOPE_LABELS,
  type PipelinePreferences,
  type ScopeLevel,
  type TopicMode,
} from '@/lib/pipeline-preferences'

export type { PipelinePreferences }

interface Props {
  value: PipelinePreferences
  onChange: (next: PipelinePreferences) => void
  disabled?: boolean
  hint?: string
}

export function PipelinePreferencesPanel({ value, onChange, disabled, hint }: Props) {
  const setTopicMode = (topicMode: TopicMode) => {
    onChange({
      ...value,
      topicMode,
      topicCustom: topicMode === 'other' ? value.topicCustom : '',
    })
  }

  const setScope = (scope: ScopeLevel) => {
    onChange({ ...value, scope })
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-zinc-100 md:p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Pipeline preferences</p>
      <p className="mt-1 text-sm text-zinc-400">
        Applied when scoring with Claude Haiku over stories from{' '}
        <span className="font-medium text-zinc-200">RSS feeds, Reddit, and Hacker News</span> — not Twitter/X or
        arbitrary web search. Topic emphasis also widens which outlets and subreddits we pull from (e.g. macro adds
        business finance RSS and investing subs). Custom text adds a Google News RSS slice plus keyword matching for
        your terms.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        When you click <span className="font-medium text-zinc-300">Run Pipeline</span>, if topic or focus calibration
        changed since your last successful run, Signal will ask to clear your scoring progress and re-score the shared
        pool (same effect as &quot;Reset scoring progress&quot;). Unchanged settings skip that step.
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="signal-topic-mode" className="block font-mono text-xs text-zinc-400">
            Topic emphasis
          </label>
          <select
            id="signal-topic-mode"
            disabled={disabled}
            value={value.topicMode}
            onChange={(e) => setTopicMode(e.target.value as TopicMode)}
            className="mt-1.5 w-full max-w-md rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {TOPIC_MODES.map((m) => (
              <option key={m} value={m} className="bg-zinc-950">
                {TOPIC_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        {value.topicMode === 'other' ? (
          <div>
            <label htmlFor="signal-topic-custom" className="block font-mono text-xs text-zinc-400">
              Custom focus (max {TOPIC_CUSTOM_MAX_LEN} chars)
            </label>
            <textarea
              id="signal-topic-custom"
              disabled={disabled}
              value={value.topicCustom}
              onChange={(e) =>
                onChange({
                  ...value,
                  topicCustom: e.target.value.slice(0, TOPIC_CUSTOM_MAX_LEN),
                })
              }
              rows={3}
              placeholder="e.g. restaking, ZK coprocessors, AI coding agents for Solidity"
              className="mt-1.5 w-full max-w-lg resize-y rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-zinc-500">
              {value.topicCustom.length}/{TOPIC_CUSTOM_MAX_LEN}
            </p>
          </div>
        ) : null}

        <div>
          <span className="block font-mono text-xs text-zinc-400">Focus calibration</span>
          <p className="mt-0.5 text-xs text-zinc-500">
            Strict relevance versus a broader lens for adjacent or early signals.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => setScope(s)}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  value.scope === s
                    ? 'border-white/30 bg-white text-black'
                    : 'border-white/10 bg-zinc-950/90 text-zinc-200 hover:border-white/20'
                }`}
              >
                {SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_PIPELINE_PREFS }
