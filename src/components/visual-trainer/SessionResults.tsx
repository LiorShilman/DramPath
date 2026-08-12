import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, StatTile } from '../ui'
import type { GradeCounts } from '../../hooks/useVisualTrainer'
import type { DynamicsSummary, ScoringSummary } from '../../domain'

export interface SessionResultsProps {
  exerciseTitle: string
  scoring: ScoringSummary
  gradeCounts: GradeCounts
  dynamicsSummary: DynamicsSummary
  onRestart: () => void
  onExit: () => void
}

const DYNAMICS_GRADE_COLOR: Record<'correct' | 'too-soft', string> = {
  correct: 'var(--color-success-text)',
  'too-soft': 'var(--color-warning-text)',
}

/** VISUAL_DRUM_TRAINER_SPEC.md §14's SessionResults — shown inline at the
 * end of a run (no persisted-session route yet; that's Stage 6, see
 * docs/implementation-status.md's Stage 5 entry for why). */
export function SessionResults({ exerciseTitle, scoring, gradeCounts, dynamicsSummary, onRestart, onExit }: SessionResultsProps) {
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

      {/* Only real MIDI hits ever carry actualVelocity — a keyboard/phone
          run has none, and showing a permanent empty chart on every one of
          those (the overwhelming majority of runs today) would be pure
          noise, so this section simply doesn't render rather than showing
          a "no data" placeholder. */}
      {dynamicsSummary.points.length > 0 && (
        <section data-testid="dynamics-chart">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">עקביות דינמיקה (מהירות הקשה)</h3>
          <Card className="[&_.recharts-cartesian-axis-tick_text]:fill-[var(--color-text-muted)]">
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={dynamicsSummary.points.map((point, index) => ({ index: index + 1, velocity: point.actualVelocity }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="index" />
                  <YAxis domain={[0, 127]} />
                  <Tooltip />
                  <Bar dataKey="velocity" name="מהירות הקשה">
                    {dynamicsSummary.points.map((point) => (
                      <Cell
                        key={point.hitId}
                        fill={point.dynamicsGrade ? DYNAMICS_GRADE_COLOR[point.dynamicsGrade] : 'var(--color-primary-text)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      )}

      <div className="flex gap-2">
        <Button onClick={onRestart}>תרגול נוסף</Button>
        <Button variant="ghost" onClick={onExit}>
          חזרה לרשימת התרגילים
        </Button>
      </div>
    </Card>
  )
}
