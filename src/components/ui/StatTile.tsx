import type { ReactNode } from 'react'
import { Card } from './Card'

export interface StatTileProps {
  label: string
  value: ReactNode
  hint?: ReactNode
}

// The big-number dashboard tiles (week completion, streak, weekly time).
// Value uses tabular-nums so digits don't jitter in width as they change.
export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <h3 className="text-sm text-[var(--color-text-muted)]">{label}</h3>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-sm text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  )
}
