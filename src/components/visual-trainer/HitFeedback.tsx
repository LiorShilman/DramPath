import { Badge, Card } from '../ui'
import type { BadgeVariant } from '../ui'
import type { HitGrade, ScoringSummary } from '../../domain'
import type { ReactNode } from 'react'

export type HitFeedbackGrade = HitGrade | 'extra'

const GRADE_LABELS: Record<HitFeedbackGrade, string> = {
  perfect: 'מושלם!',
  early: 'מוקדם',
  late: 'מאוחר',
  miss: 'פספוס',
  extra: 'הקשה שגויה',
}

const GRADE_VARIANTS: Record<HitFeedbackGrade, BadgeVariant> = {
  perfect: 'success',
  early: 'warning',
  late: 'warning',
  miss: 'danger',
  extra: 'danger',
}

export interface HitFeedbackProps {
  lastGrade: HitFeedbackGrade | undefined
  scoring: ScoringSummary
}

// A compact local stat tile (Card padding="sm" + smaller text) instead of
// the shared dashboard-style StatTile (padding="md" + text-2xl) — this row
// is competing for space with the highway/kit on an already-tight runner
// layout, unlike the dashboard's own generously-spaced tiles.
function CompactStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card padding="sm" className="flex flex-col gap-0.5">
      <h3 className="text-xs text-[var(--color-text-muted)]">{label}</h3>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </Card>
  )
}

/** VISUAL_DRUM_TRAINER_SPEC.md §5's feedback area — Perfect/Early/Late/Miss,
 * Combo, Accuracy, and Timing Error. */
export function HitFeedback({ lastGrade, scoring }: HitFeedbackProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Always reserved (even empty) at a fixed height — letting this row
          only appear once a grade exists means the layout grows the moment
          you actually hit a note, which is exactly when overflow would
          newly appear despite fitting perfectly at idle. A fixed h-6 (not
          the original h-8) keeps that growth from ever happening while
          still being smaller than before. */}
      <div className="flex h-6 items-center">
        {lastGrade && <Badge variant={GRADE_VARIANTS[lastGrade]}>{GRADE_LABELS[lastGrade]}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactStat label="דיוק" value={`${Math.round(scoring.accuracyPercent)}%`} />
        <CompactStat label="קומבו נוכחי" value={scoring.currentCombo} />
        <CompactStat label="קומבו שיא" value={scoring.bestCombo} />
        <CompactStat
          label="סטיית תזמון ממוצעת"
          value={
            scoring.averageTimingErrorMs === undefined ? '—' : `${Math.round(scoring.averageTimingErrorMs)}ms`
          }
        />
      </div>
    </div>
  )
}
