import { Badge, StatTile } from '../ui'
import type { BadgeVariant } from '../ui'
import type { HitGrade, ScoringSummary } from '../../domain'

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

/** VISUAL_DRUM_TRAINER_SPEC.md §5's feedback area — Perfect/Early/Late/Miss,
 * Combo, Accuracy, and Timing Error. */
export function HitFeedback({ lastGrade, scoring }: HitFeedbackProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-8 items-center">
        {lastGrade && <Badge variant={GRADE_VARIANTS[lastGrade]}>{GRADE_LABELS[lastGrade]}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="דיוק" value={`${Math.round(scoring.accuracyPercent)}%`} />
        <StatTile label="קומבו נוכחי" value={scoring.currentCombo} />
        <StatTile label="קומבו שיא" value={scoring.bestCombo} />
        <StatTile
          label="סטיית תזמון ממוצעת"
          value={
            scoring.averageTimingErrorMs === undefined ? '—' : `${Math.round(scoring.averageTimingErrorMs)}ms`
          }
        />
      </div>
    </div>
  )
}
