import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, StatTile } from '../ui'
import { ACCENT_VELOCITY_MARGIN } from '../../domain/calculations/hit-matcher'
import type { GradeCounts } from '../../hooks/useVisualTrainer'
import type { DynamicsSummary, ScoringSummary } from '../../domain'

export interface SessionResultsProps {
  exerciseTitle: string
  scoring: ScoringSummary
  gradeCounts: GradeCounts
  dynamicsSummary: DynamicsSummary
  onRestart: () => void
  onExit: () => void
  /** "חזרה לרשימת התרגילים" by default — RoutinePlayerPage overrides it to
   * "סיום השגרה"/"יציאה מהשגרה" since exiting mid/after a routine goes back
   * to the routine, not the flat exercise list. */
  exitLabel?: string
  /** Practice-routine only (RoutinePlayerPage) — renders an extra button
   * alongside restart/exit. Absent on a plain single-exercise run and on a
   * routine's last step. */
  onNext?: () => void
  nextLabel?: string
}

const DYNAMICS_GRADE_COLOR: Record<'correct' | 'too-soft', string> = {
  correct: 'var(--color-success-text)',
  'too-soft': 'var(--color-warning-text)',
}

/** VISUAL_DRUM_TRAINER_SPEC.md §14's SessionResults — shown inline at the
 * end of a run (no persisted-session route yet; that's Stage 6, see
 * docs/implementation-status.md's Stage 5 entry for why). */
export function SessionResults({
  exerciseTitle,
  scoring,
  gradeCounts,
  dynamicsSummary,
  onRestart,
  onExit,
  exitLabel = 'חזרה לרשימת התרגילים',
  onNext,
  nextLabel = 'לתרגיל הבא',
}: SessionResultsProps) {
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
      {dynamicsSummary.points.length > 0 && (() => {
        // Raw MIDI velocity (0-127) reads as an arbitrary technical number —
        // percent-of-max is the same data, immediately legible without
        // knowing what "velocity 100" even means.
        const toPercent = (velocity: number) => Math.round((velocity / 127) * 100)
        const averageVelocity =
          dynamicsSummary.points.reduce((sum, point) => sum + point.actualVelocity, 0) / dynamicsSummary.points.length
        const chartData = dynamicsSummary.points.map((point, index) => ({
          index: index + 1,
          hitId: point.hitId,
          velocityPercent: toPercent(point.actualVelocity),
          dynamicsGrade: point.dynamicsGrade,
        }))
        // An accented note already has a real correct/too-soft grade (against
        // its OWN authored target, not the run's average) — reuse that
        // directly. A plain (unaccented) note has no such target, so its bar
        // is instead colored by how far it strayed from THIS run's own
        // average — exactly the "was I consistent?" question a hands-only
        // technique exercise (no accents at all) is actually asking.
        // ACCENT_VELOCITY_MARGIN (hit-matcher.ts) is reused as the same
        // natural hit-to-hit noise floor it already represents elsewhere,
        // not a new made-up threshold.
        const barColor = (point: (typeof chartData)[number]) => {
          if (point.dynamicsGrade) return DYNAMICS_GRADE_COLOR[point.dynamicsGrade]
          const deviatesFromAverage = Math.abs(point.velocityPercent - toPercent(averageVelocity)) > toPercent(ACCENT_VELOCITY_MARGIN)
          return deviatesFromAverage ? 'var(--color-warning-text)' : 'var(--color-success-text)'
        }
        return (
          <section data-testid="dynamics-chart">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">עקביות דינמיקה (עוצמת הקשה)</h3>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-success-text)]" aria-hidden="true" />
                  עקבי
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-warning-text)]" aria-hidden="true" />
                  סטייה
                </span>
              </div>
            </div>
            <Card className="[&_.recharts-cartesian-axis-tick_text]:fill-[var(--color-text-muted)]">
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="index" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} fontSize={11} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={40}
                    />
                    <ReferenceLine
                      y={toPercent(averageVelocity)}
                      stroke="var(--color-text-muted)"
                      strokeDasharray="4 4"
                      label={{
                        value: `ממוצע ${toPercent(averageVelocity)}%`,
                        position: 'insideTopRight',
                        fill: 'var(--color-text-muted)',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
                      contentStyle={{
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-card)',
                        fontSize: 12,
                      }}
                      labelFormatter={(label) => `הקשה ${label}`}
                      formatter={(value) => [`${value}%`, 'עוצמה']}
                    />
                    <Bar dataKey="velocityPercent" name="עוצמה" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {chartData.map((point) => (
                        <Cell key={point.hitId} fill={barColor(point)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        )
      })()}

      <div className="flex gap-2">
        <Button onClick={onRestart}>תרגול נוסף</Button>
        {onNext && <Button onClick={onNext}>{nextLabel}</Button>}
        <Button variant="ghost" onClick={onExit}>
          {exitLabel}
        </Button>
      </div>
    </Card>
  )
}
