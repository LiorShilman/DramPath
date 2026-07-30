import { Badge, Button, Card, StatTile } from '../ui'
import type { GradeCounts } from '../../hooks/useVisualTrainer'
import type { ScoringSummary } from '../../domain'

export interface SessionResultsProps {
  exerciseTitle: string
  scoring: ScoringSummary
  gradeCounts: GradeCounts
  onRestart: () => void
  onExit: () => void
}

/** VISUAL_DRUM_TRAINER_SPEC.md §14's SessionResults — shown inline at the
 * end of a run (no persisted-session route yet; that's Stage 6, see
 * docs/implementation-status.md's Stage 5 entry for why). */
export function SessionResults({ exerciseTitle, scoring, gradeCounts, onRestart, onExit }: SessionResultsProps) {
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">סיום תרגול — {exerciseTitle}</h2>
        <p className="text-sm text-[var(--color-text-muted)]">כל הכבוד! הנה הסיכום שלך.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="דיוק" value={`${Math.round(scoring.accuracyPercent)}%`} />
        <StatTile label="קומבו שיא" value={scoring.bestCombo} />
        <StatTile
          label="סטיית תזמון ממוצעת"
          value={
            scoring.averageTimingErrorMs === undefined ? '—' : `${Math.round(scoring.averageTimingErrorMs)}ms`
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">מושלם: {gradeCounts.perfect}</Badge>
        <Badge variant="warning">מוקדם: {gradeCounts.early}</Badge>
        <Badge variant="warning">מאוחר: {gradeCounts.late}</Badge>
        <Badge variant="danger">פספוס: {gradeCounts.miss}</Badge>
        <Badge variant="danger">הקשות שגויות: {gradeCounts.extra}</Badge>
      </div>

      <div className="flex gap-2">
        <Button onClick={onRestart}>תרגול נוסף</Button>
        <Button variant="ghost" onClick={onExit}>
          חזרה לרשימת התרגילים
        </Button>
      </div>
    </Card>
  )
}
