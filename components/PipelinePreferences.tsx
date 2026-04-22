'use client'

import {
  BUDGET_PRESET_LABELS,
  BUDGET_PRESETS,
  BUDGET_PRESET_TUNING,
  DEFAULT_PIPELINE_PREFS,
  matchBudgetPreset,
  SCOPES,
  TOPIC_CUSTOM_MAX_LEN,
  TOPIC_MODES,
  TOPIC_MODE_LABELS,
  SCOPE_LABELS,
  type PipelinePreferences,
  type PipelineRunTuning,
  type ScopeLevel,
  type TopicMode,
} from '@/lib/pipeline-preferences'

export type { PipelinePreferences, PipelineRunTuning }

interface Props {
  value: PipelinePreferences
  onChange: (next: PipelinePreferences) => void
  runTuning: PipelineRunTuning
  onRunTuningChange: (next: PipelineRunTuning) => void
  disabled?: boolean
  hint?: string
}

export function PipelinePreferencesPanel({
  value,
  onChange,
  runTuning,
  onRunTuningChange,
  disabled,
  hint,
}: Props) {
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
    <div className="text-zinc-100">
      {hint ? <p className="mb-3 text-xs text-zinc-500">{hint}</p> : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="signal-topic-mode" className="block font-mono text-xs text-zinc-400">
            Topic
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
          <span className="block font-mono text-xs text-zinc-400">Focus</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
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

        <div className="border-t border-white/10 pt-3">
          <span className="block font-mono text-xs text-zinc-400">Token budget</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {BUDGET_PRESETS.map((preset) => {
              const { label, hint } = BUDGET_PRESET_LABELS[preset]
              const active = matchBudgetPreset(runTuning) === preset
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => onRunTuningChange(BUDGET_PRESET_TUNING[preset])}
                  className={`flex flex-col rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? 'border-white/30 bg-white text-black'
                      : 'border-white/10 bg-zinc-950/90 text-zinc-200 hover:border-white/20'
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className={`mt-0.5 text-[11px] ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>{hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export { DEFAULT_PIPELINE_PREFS }
