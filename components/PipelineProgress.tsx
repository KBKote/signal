'use client'

export type StepState = 'pending' | 'running' | 'done' | 'error'

interface Props {
  steps: { label: string; state: StepState }[]
}

export function PipelineProgress({ steps }: Props) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-zinc-300"
      role="status"
      aria-live="polite"
    >
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Pipeline status</p>
      <ul className="space-y-1">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 w-4 shrink-0 text-center">
              {step.state === 'done'
                ? '✓'
                : step.state === 'error'
                  ? '✕'
                  : step.state === 'running'
                    ? '●'
                    : '○'}
            </span>
            <span
              className={
                step.state === 'running'
                  ? 'animate-pulse font-medium text-zinc-100'
                  : step.state === 'done'
                    ? 'text-zinc-500'
                    : step.state === 'error'
                      ? 'text-red-400'
                      : 'text-zinc-600'
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
