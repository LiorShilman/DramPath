import { Badge, Card } from '../ui'
import type { BadgeVariant } from '../ui'
import { LiveAccuracyMeter } from './LiveAccuracyMeter'
import type { DynamicsGrade, HitGrade, ScoringSummary } from '../../domain'
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

// Dynamics (MIDI-only, see useVisualTrainer's lastDynamicsGrade doc
// comment) — a separate badge from the timing grade above, not merged
// into GRADE_LABELS/HitFeedbackGrade, since it answers a different
// question ("hit hard enough") and is only ever present for a subset of
// hits (accented notes struck via a real e-kit).
const DYNAMICS_GRADE_LABELS: Record<DynamicsGrade, string> = {
  correct: 'אקצנט מדויק',
  'too-soft': 'אקצנט רך מדי',
}
const DYNAMICS_GRADE_VARIANTS: Record<DynamicsGrade, BadgeVariant> = {
  correct: 'success',
  'too-soft': 'warning',
}

export interface HitFeedbackProps {
  lastGrade: HitFeedbackGrade | undefined
  lastDynamicsGrade: DynamicsGrade | undefined
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
export function HitFeedback({ lastGrade, lastDynamicsGrade, scoring }: HitFeedbackProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Always reserved (even empty) at a fixed height — letting this row
          only appear once a grade exists means the layout grows the moment
          you actually hit a note, which is exactly when overflow would
          newly appear despite fitting perfectly at idle. A fixed h-6 (not
          the original h-8) keeps that growth from ever happening while
          still being smaller than before. */}
      <div className="flex h-6 items-center gap-1.5">
        {lastGrade && <Badge variant={GRADE_VARIANTS[lastGrade]}>{GRADE_LABELS[lastGrade]}</Badge>}
        {lastDynamicsGrade && (
          <Badge variant={DYNAMICS_GRADE_VARIANTS[lastDynamicsGrade]}>{DYNAMICS_GRADE_LABELS[lastDynamicsGrade]}</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* A visual gauge alongside the number (explicit user request: see
            accuracy at a glance during the run, not just read a digit) —
            its own component instead of CompactStat's plain text `value`,
            since the bar needs its own markup, not just a bigger font. */}
        <Card padding="sm" className="flex flex-col justify-center gap-0.5">
          <h3 className="text-xs text-[var(--color-text-muted)]">דיוק</h3>
          <LiveAccuracyMeter accuracyPercent={scoring.accuracyPercent} />
        </Card>
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
