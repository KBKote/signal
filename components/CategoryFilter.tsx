'use client'

export type Category = 'all' | 'opportunity' | 'idea' | 'intel'

const TABS: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'opportunity', label: 'Opportunities' },
  { value: 'idea', label: 'Ideas' },
  { value: 'intel', label: 'Intel' },
]

interface Props {
  active: Category
  onChange: (cat: Category) => void
  counts: Record<Category, number>
}

export function CategoryFilter({ active, onChange, counts }: Props) {
  return (
    <nav className="flex gap-1 rounded-xl border border-white/10 bg-black/45 p-1 backdrop-blur-md">
      {TABS.map((tab) => {
        const isActive = active === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? 'bg-white text-black shadow'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <span className={isActive ? 'text-black' : 'text-zinc-300'}>{tab.label}</span>
            {counts[tab.value] > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  isActive ? 'bg-black/10 text-black' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {counts[tab.value]}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
